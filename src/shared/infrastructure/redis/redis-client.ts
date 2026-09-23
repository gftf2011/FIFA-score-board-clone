import Redis from 'ioredis';

/**
 * Instância única (singleton) do cliente Redis, reaproveitada entre chamadas.
 * A URL vem de `REDIS_URL`.
 */
export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
