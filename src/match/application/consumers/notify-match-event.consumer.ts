import {
  MatchEventType,
  MatchStatus,
  type MatchEvent,
} from '../../domain/aggregates/match.aggregate';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';
import type { MatchProjectionRepository } from '../../domain/repositories/match-projection.repository';

/**
 * Consumidor dos eventos vindos da fila (SQS). Projeta o estado no Redis
 * conforme o **tipo** do evento e depois publica no pub/sub para os assinantes
 * SSE.
 *
 * A linha do tempo é comum a todo evento; o efeito específico varia por tipo:
 *  - gol / gol contra → credita o placar do time;
 *  - início / encerramento → materializa o status;
 *  - demais (substituição, falta, escanteio, ...) → só a linha do tempo.
 *
 * Todas as operações da projeção são idempotentes (dedup por `eventId`, membro
 * único por `sequence`), então a reentrega do SQS é segura.
 */
export class NotifyMatchEventConsumer {
  constructor(
    private readonly projection: MatchProjectionRepository,
    private readonly publisher: MatchEventPublisher,
  ) {}

  async handle(event: MatchEvent): Promise<void> {
    await this.project(event);
    await this.publisher.publish(event);
  }

  private async project(event: MatchEvent): Promise<void> {
    // Comum a todo evento: empilha na linha do tempo + metadados.
    await this.projection.appendEvent(event);

    // Efeito específico por tipo.
    switch (event.type) {
      case MatchEventType.Goal:
        if (typeof event.teamId === 'string') {
          await this.projection.incrementScore({
            matchId: event.matchId,
            teamId: event.teamId,
            eventId: event.id,
          });
        }
        return;
      case MatchEventType.OwnGoal:
        if (typeof event.beneficiaryTeamId === 'string') {
          await this.projection.incrementScore({
            matchId: event.matchId,
            teamId: event.beneficiaryTeamId,
            eventId: event.id,
          });
        }
        return;
      case MatchEventType.MatchStarted:
        await this.projection.setStatus({ matchId: event.matchId, status: MatchStatus.InProgress });
        return;
      case MatchEventType.MatchFinished:
        await this.projection.setStatus({ matchId: event.matchId, status: MatchStatus.Finished });
        return;
      default:
        // Substituição, falta, escanteio, etc.: já registrados na linha do tempo.
        return;
    }
  }
}
