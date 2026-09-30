import type { ActorContext } from './actor';

declare global {
  namespace Express {
    interface Request {
      actor?: ActorContext;
      validated?: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

export {};
