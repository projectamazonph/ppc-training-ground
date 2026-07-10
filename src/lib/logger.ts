import pino from 'pino';

export const logger = pino({
  name: 'amph-v2',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: [
    'password',
    'passwordHash',
    'token',
    'secret',
    'apiKey',
    'Authorization',
    'cookie',
    'req.headers.authorization',
    '*.password',
    '*.passwordHash',
    '*.token',
  ],
});
