import { redis } from '../../../../shared/infrastructure/redis/redis-client';
import { NotifyMatchEventConsumer } from '../../../application/consumers/notify-match-event.consumer';
import { RedisMatchEventPublisher } from '../../../infrastructure/publishers/redis-match-event.publisher';
import { RedisMatchProjectionRepository } from '../../../infrastructure/repositories/redis-match-projection.repository';

/**
 * Monta o consumidor: projeta o estado no Redis (read model) e publica no
 * pub/sub. Ambos usam o mesmo cliente Redis compartilhado.
 */
export function makeNotifyMatchEventConsumer(): NotifyMatchEventConsumer {
  const projection = new RedisMatchProjectionRepository(redis);
  const publisher = new RedisMatchEventPublisher(redis);
  return new NotifyMatchEventConsumer(projection, publisher);
}
