import type { UseCase } from '../../../shared/application/use-case';
import type { MatchEventListener } from '../../domain/subscribers/match-event.subscriber';
import type { MatchStreamRegistry } from '../streaming/match-stream-registry';

/** Entrada: a partida e o mesmo ouvinte usado na inscrição. */
export interface UnsubscribeFromMatchEventsInput {
  readonly matchId: string;
  readonly listener: MatchEventListener;
}

/**
 * Caso de uso: cancela a inscrição de um cliente nos eventos de uma partida
 * (ex.: quando a conexão SSE fecha). Remove o ouvinte do registro.
 */
export class UnsubscribeFromMatchEventsUseCase
  implements UseCase<UnsubscribeFromMatchEventsInput, void>
{
  constructor(private readonly registry: MatchStreamRegistry) {}

  execute(input: UnsubscribeFromMatchEventsInput): Promise<void> {
    this.registry.remove(input.matchId, input.listener);
    return Promise.resolve();
  }
}
