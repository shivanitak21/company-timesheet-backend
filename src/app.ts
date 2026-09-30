import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { APP_NAME } from './config/constants';
import { health, ready } from './controllers/health.controller';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { apiLimiter } from './middleware/rateLimiter';
import { apiRouter } from './routes';
import { AppError } from './utils/AppError';
import { logger } from './utils/logger';
import { sendSuccess } from './utils/http';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const header = req.headers['x-request-id'];
      const incoming = Array.isArray(header) ? header[0] : header;
      const id = incoming && incoming.length <= 100 ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
  }),
);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new AppError(403, 'CORS_FORBIDDEN', 'Origin not allowed'));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Client-Platform'],
    exposedHeaders: ['X-Request-Id'],
  }),
);
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  sendSuccess(res, { name: APP_NAME, version: '1.0.0' });
});
app.get('/health', health);
app.get('/ready', ready);

if (env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}
app.use('/api/v1', apiRouter);
app.use(notFound);
app.use(errorHandler);
