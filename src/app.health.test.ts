import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { Express } from 'express';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/company_timesheet_test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-should-be-32-characters-min';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-should-be-32-characters-min';
process.env.CLIENT_WEB_URL = 'http://localhost:5173';
process.env.CLIENT_MOBILE_URL = 'http://localhost:8081';
process.env.COMPANY_TIMEZONE = 'Asia/Kolkata';
process.env.BCRYPT_ROUNDS = '10';

describe('http shell', () => {
  let app: Express;

  before(async () => {
    app = (await import('./app')).app;
  });

  it('GET /health returns the shared envelope', async () => {
    const response = await request(app).get('/health');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.status, 'ok');
  });

  it('GET /ready reports that the database is down', async () => {
    const response = await request(app).get('/ready');
    assert.equal(response.status, 503);
    assert.equal(response.body.success, false);
    assert.equal(response.body.error.code, 'NOT_READY');
  });

  it('GET /api/v1/auth/me requires a bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    assert.equal(response.status, 401);
    assert.equal(response.body.error.code, 'MISSING_TOKEN');
  });

  it('POST /api/v1/auth/login rejects an invalid body', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    assert.equal(response.status, 422);
    assert.equal(response.body.error.code, 'VALIDATION_ERROR');
  });
});
