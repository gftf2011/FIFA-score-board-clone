import type { UseCase } from '../../../shared/application/use-case';
import type { MatchSnapshot } from '../../domain/aggregates/match-projection.aggregate';
import type { MatchEventListener } from '../../domain/subscribers/match-event.subscriber';
import type { MatchStreamRegistry } from '../streaming/match-stream-registry';

/** Entrada: a partida e o ouvinte que receberá os eventos ao vivo. */
export interface SubscribeToMatchEventsInput {
  readonly matchId: string;
  readonly listener: MatchEventListener;
}

/**
 * Caso de uso: inscreve um cliente nos eventos ao vivo de uma partida. Registra
 * o ouvinte e devolve o snapshot atual (estado do jogo até o momento) para quem
 * conecta no meio. A entrega ao vivo passa a chegar pelo `listener`.
 */
export class SubscribeToMatchEventsUseCase
  implements UseCase<SubscribeToMatchEventsInput, MatchSnapshot>
{
  constructor(private readonly registry: MatchStreamRegistry) {}

  execute(input: SubscribeToMatchEventsInput): Promise<MatchSnapshot> {
    return this.registry.add(input.matchId, input.listener);
  }
}
