import type Redis from 'ioredis';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';

/**
 * Canal pub/sub por partida, no qual os assinantes SSE se inscrevem. Usa o
 * prefixo `channel:` para não coincidir com nenhuma chave do keyspace da
 * projeção (ex.: o ZSET `match:{id}:events`) — canais e keyspace são namespaces
 * separados no Redis, mas manter nomes distintos evita confusão e armadilhas.
 */
export function matchChannel(matchId: string): string {
  return `channel:match:${matchId}:events`;
}

/**
 * Publica o evento no pub/sub do Redis, no canal da partida. Os endpoints SSE
 * se inscrevem no canal e repassam aos clientes.
 */
export class RedisMatchEventPublisher implements MatchEventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(event: MatchEvent): Promise<void> {
    await this.redis.publish(matchChannel(event.matchId), JSON.stringify(event));
  }
}
