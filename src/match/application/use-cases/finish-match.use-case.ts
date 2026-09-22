import type { MatchRecordPublisher } from '../../domain/publishers/match-record.publisher.js';
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
 * record de partida encerrada), persiste o novo estado e publica o record mais
 * recente. As invariantes de transição de status ficam no próprio agregado.
 */
export class FinishMatchUseCase {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly recordPublisher: MatchRecordPublisher,
  ) {}

  async execute(input: FinishMatchInput): Promise<void> {
    const match = await this.matchRepository.findById(input.matchId);
    if (match === null) throw new MatchNotFoundError(input.matchId);

    match.finish();
    await this.matchRepository.update(match);

    const latestRecord = match.latestRecord;
    if (latestRecord !== undefined) await this.recordPublisher.publish(latestRecord);
  }
}
