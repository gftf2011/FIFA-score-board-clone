import type { UseCase } from '../../../shared/application/use-case';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';
import type { MatchRepository } from '../../domain/repositories/match.repository';
import { MatchNotFoundError } from '../errors/match-not-found.error';

/** Entrada do caso de uso de iniciar partida. */
export interface StartMatchInput {
  readonly matchId: string;
}

/**
 * Caso de uso: inicia uma partida agendada.
 *
 * Carrega o agregado, aplica a regra de início (que também registra o evento
 * de partida iniciada), persiste o novo estado e publica o evento mais recente
 * no SNS. As invariantes de transição de status ficam no próprio agregado.
 */
export class StartMatchUseCase implements UseCase<StartMatchInput, void> {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly eventPublisher: MatchEventPublisher,
  ) {}

  async execute(input: StartMatchInput): Promise<void> {
    const match = await this.matchRepository.findById(input.matchId);
    if (match === null) throw new MatchNotFoundError(input.matchId);

    match.start();
    await this.matchRepository.update(match);

    const latestEvent = match.latestEvent;
    if (latestEvent !== undefined) await this.eventPublisher.publish(latestEvent);
  }
}
