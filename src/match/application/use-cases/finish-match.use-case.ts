import type { UseCase } from '../../../shared/application/use-case.js';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher.js';
import type { MatchRepository } from '../../domain/repositories/match.repository.js';
import { MatchNotFoundError } from '../errors/match-not-found.error.js';

/** Entrada do caso de uso de encerrar partida. */
export interface FinishMatchInput {
  readonly matchId: string;
}

/**
 * Caso de uso: encerra uma partida em andamento.
 *
 * Carrega o agregado, aplica a regra de encerramento (que também registra o
 * evento de partida encerrada), persiste o novo estado e publica o evento mais
 * recente. As invariantes de transição de status ficam no próprio agregado.
 */
export class FinishMatchUseCase implements UseCase<FinishMatchInput, void> {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly eventPublisher: MatchEventPublisher,
  ) {}

  async execute(input: FinishMatchInput): Promise<void> {
    const match = await this.matchRepository.findById(input.matchId);
    if (match === null) throw new MatchNotFoundError(input.matchId);

    match.finish();
    await this.matchRepository.update(match);

    const latestEvent = match.latestEvent;
    if (latestEvent !== undefined) await this.eventPublisher.publish(latestEvent);
  }
}
