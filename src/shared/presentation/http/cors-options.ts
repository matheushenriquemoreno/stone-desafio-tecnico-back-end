import type { CorsOptions } from 'cors';

const ALLOWED_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const ALLOWED_HEADERS = ['Content-Type'] as const;

export function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  return {
    allowedHeaders: [...ALLOWED_HEADERS],
    credentials: true,
    exposedHeaders: ['Retry-After'],
    methods: [...ALLOWED_METHODS],
    optionsSuccessStatus: 204,
    origin: (requestOrigin, callback) => {
      if (requestOrigin === undefined || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  };
}
