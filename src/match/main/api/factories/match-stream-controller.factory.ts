import type Redis from 'ioredis';
import { MatchStreamRegistry } from '../../../application/streaming/match-stream-registry';
import { SubscribeToMatchEventsUseCase } from '../../../application/use-cases/subscribe-to-match-events.use-case';
import { UnsubscribeFromMatchEventsUseCase } from '../../../application/use-cases/unsubscribe-from-match-events.use-case';
import { RedisMatchProjectionRepository } from '../../../infrastructure/repositories/redis-match-projection.repository';
import { RedisMatchEventSubscriber } from '../../../infrastructure/subscribers/redis-match-event.subscriber';
import { MatchStreamController } from '../../../presentation/http/match-stream.controller';

/** Dependências da API de stream. */
export interface MatchStreamControllerDeps {
  readonly redis: Redis;
}

/**
 * Composition root do stream: assinante e projeção (Redis) alimentam o registro
 * singleton (estado do jogo em memória, fan-out), envolvido pelos casos de uso
 * Subscribe/Unsubscribe que o controller consome. Não toca no Postgres.
 */
export function makeMatchStreamController(deps: MatchStreamControllerDeps): MatchStreamController {
  const subscriber = new RedisMatchEventSubscriber(deps.redis);
  const projection = new RedisMatchProjectionRepository(deps.redis);
  const registry = new MatchStreamRegistry(subscriber, projection);

  return new MatchStreamController(
    new SubscribeToMatchEventsUseCase(registry),
    new UnsubscribeFromMatchEventsUseCase(registry),
  );
}
