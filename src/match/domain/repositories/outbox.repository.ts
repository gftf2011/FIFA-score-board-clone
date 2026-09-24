import type { MatchEvent } from '../aggregates/match.aggregate';

/** Mensagem pendente no outbox: o id da linha e o evento a ser publicado. */
export interface PendingOutboxMessage {
  readonly id: string;
  readonly event: MatchEvent;
}

/**
 * Port do transactional outbox. O lado de escrita (`save`) é chamado dentro da
 * transação da partida, tornando a gravação do evento atômica com a mudança de
 * estado. O lado de leitura (`pullPending` / `markPublished` / `registerFailure`)
 * é usado pelo relay, que move as mensagens do banco para o broker.
 *
 * A implementação concreta vive na infraestrutura (inversão de dependência).
 */
export interface OutboxRepository {
  /** Persiste o evento como mensagem pendente (idempotente pelo id do evento). */
  save(event: MatchEvent): Promise<void>;
  /** Lê as mensagens ainda não publicadas, mais antigas primeiro. */
  pullPending(limit: number): Promise<PendingOutboxMessage[]>;
  /** Marca a mensagem como publicada (não será mais reentregue). */
  markPublished(id: string): Promise<void>;
  /** Contabiliza uma falha de publicação (para observabilidade/retry). */
  registerFailure(id: string): Promise<void>;
}
