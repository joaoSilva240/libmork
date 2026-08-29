import Redis from 'ioredis';
import { logger } from '@/lib/logger';

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    redis.on('error', (err) => logger.warn({ err }, 'Redis connection error'));
  } catch (err) {
    logger.warn({ err }, 'Redis initialization failed, continuing without cache');
  }
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    if (!redis) return;
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.warn({ err, key }, 'Cache set failed');
    }
  },
  async del(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, 'Cache delete failed');
    }
  },
};
