import type Redis from 'ioredis';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type {
  IncrementScoreInput,
  MatchProjectionRepository,
  SetStatusInput,
} from '../../domain/repositories/match-projection.repository';

/**
 * Projeção da partida no Redis com comandos idempotentes (sem script Lua).
 * Estruturas:
 *  - `match:{id}` (HASH) → `status`, `competitionId`, `updatedAt`, `lastEventId`.
 *  - `match:{id}:goals:{teamId}` (SET) → um gol é o `eventId`; placar = `SCARD`.
 *  - `match:{id}:events` (ZSET) → linha do tempo por `sequence` (membro único).
 *
 * Todas as operações criam suas próprias chaves ao escrever, então independem
 * da ordem de chegada (um gol pode chegar antes do início, por exemplo).
 */
export class RedisMatchProjectionRepository implements MatchProjectionRepository {
  constructor(private readonly redis: Redis) {}

  async appendEvent(event: MatchEvent): Promise<void> {
    const base = `match:${event.matchId}`;
    const pipeline = this.redis.pipeline();
    pipeline.zadd(`${base}:events`, event.sequence, JSON.stringify(event));
    pipeline.hset(
      base,
      'matchId',
      event.matchId,
      'competitionId',
      event.competitionId,
      'updatedAt',
      new Date().toISOString(),
      'lastEventId',
      event.id,
    );
    await pipeline.exec();
  }

  async incrementScore(input: IncrementScoreInput): Promise<void> {
    await this.redis.sadd(`match:${input.matchId}:goals:${input.teamId}`, input.eventId);
  }

  async setStatus(input: SetStatusInput): Promise<void> {
    await this.redis.hset(`match:${input.matchId}`, 'status', input.status);
  }
}
