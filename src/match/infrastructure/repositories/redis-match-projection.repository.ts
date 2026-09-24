import type Redis from 'ioredis';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import { MatchProjection } from '../../domain/aggregates/match-projection.aggregate';
import type {
  MatchProjectionRepository,
  MatchSnapshot,
} from '../../domain/repositories/match-projection.repository';

/**
 * Projeção da partida no Redis. Persiste apenas a linha do tempo:
 *  - `match:{id}:events` (ZSET) → eventos por `sequence` (membro único).
 *
 * O estado derivado (status, placar) é reconstruído da linha do tempo pelo
 * reducer de projeção — não há estruturas separadas para placar/status.
 */
export class RedisMatchProjectionRepository implements MatchProjectionRepository {
  constructor(private readonly redis: Redis) {}

  async appendEvent(event: MatchEvent): Promise<void> {
    await this.redis.zadd(`match:${event.matchId}:events`, event.sequence, JSON.stringify(event));
  }

  async loadSnapshot(matchId: string): Promise<MatchSnapshot | null> {
    const raw = await this.redis.zrange(`match:${matchId}:events`, '0', '-1');
    if (raw.length === 0) return null;

    const events = raw
      .map((entry) => {
        try {
          return JSON.parse(entry) as MatchEvent;
        } catch {
          return null;
        }
      })
      .filter((event): event is MatchEvent => event !== null);

    return MatchProjection.fromEvents(matchId, events).toSnapshot();
  }
}
