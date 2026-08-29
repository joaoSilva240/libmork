import pino from 'pino';
import { headers } from 'next/headers';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

export const logger = pino({
  level: logLevel,
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export async function getLogger() {
  try {
    const h = await headers();
    const correlationId = h.get('x-correlation-id');
    return correlationId ? logger.child({ correlationId }) : logger;
  } catch {
    // Contexto sem request (ex: módulo de nível superior) — retorna logger base
    return logger;
  }
}
