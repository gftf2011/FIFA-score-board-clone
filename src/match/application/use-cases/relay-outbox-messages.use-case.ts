import type { UseCase } from '../../../shared/application/use-case';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';
import type { OutboxRepository } from '../../domain/repositories/outbox.repository';

/** Entrada do relay: tamanho máximo do lote lido por rodada. */
export interface RelayOutboxMessagesInput {
  readonly batchSize: number;
}

/**
 * Caso de uso: escoa um lote do outbox para o broker. Lê as mensagens pendentes
 * pelo {@link OutboxRepository}, publica cada uma pelo {@link MatchEventPublisher}
 * e a marca como publicada; em falha, contabiliza a tentativa e segue (a
 * mensagem será reentregue numa próxima rodada — semântica at-least-once).
 *
 * Depende apenas de ports do domínio: a fonte (outbox) e o destino (broker) são
 * injetados, sem acoplamento a Prisma ou SNS.
 */
export class RelayOutboxMessagesUseCase implements UseCase<RelayOutboxMessagesInput, number> {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly publisher: MatchEventPublisher,
  ) {}

  /** Processa um lote; retorna quantas mensagens foram lidas (não necessariamente publicadas). */
  async execute(input: RelayOutboxMessagesInput): Promise<number> {
    const pending = await this.outbox.pullPending(input.batchSize);

    for (const message of pending) {
      try {
        await this.publisher.publish(message.event);
        await this.outbox.markPublished(message.id);
      } catch (error) {
        await this.outbox.registerFailure(message.id);
        console.error('Falha ao publicar mensagem do outbox', message.id, error);
      }
    }

    return pending.length;
  }
}
