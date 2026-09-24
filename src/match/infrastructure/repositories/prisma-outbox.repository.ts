import type { Prisma, PrismaClient } from '@prisma/client';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type {
  OutboxRepository,
  PendingOutboxMessage,
} from '../../domain/repositories/outbox.repository';
import { getTransactionClient } from '../../../shared/infrastructure/prisma/transaction-context';

/** Client capaz de executar queries — transação ambiente ou client base. */
type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

/** Linha crua do outbox lida pelo relay (`payload` é o MatchEvent em jsonb). */
interface OutboxRow {
  id: string;
  payload: MatchEvent;
}

/**
 * Implementação do {@link OutboxRepository} sobre PostgreSQL via Prisma, usando
 * raw queries (`$queryRaw`/`$executeRaw`) — mesma abordagem do
 * {@link file://src/match/infrastructure/repositories/prisma-match.repository.ts}.
 *
 * `save` reaproveita a transação ambiente da UnitOfWork, gravando o evento na
 * mesma transação que persiste a partida. `payload` guarda o {@link MatchEvent}
 * serializado por completo, para o relay republicá-lo sem perdas.
 */
export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Reaproveita a transação ambiente (UnitOfWork) quando existir. */
  private get db(): PrismaExecutor {
    return getTransactionClient() ?? this.prisma;
  }

  async save(event: MatchEvent): Promise<void> {
    // `event.id` como PK torna a gravação idempotente; `ON CONFLICT` protege
    // contra reprocessamentos do mesmo evento.
    await this.db.$executeRaw`
      INSERT INTO outbox_messages (id, match_id, type, payload)
      VALUES (${event.id}, ${event.matchId}, ${event.type}::"MatchEventType", ${JSON.stringify(event)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `;
  }

  async pullPending(limit: number): Promise<PendingOutboxMessage[]> {
    const rows = await this.prisma.$queryRaw<OutboxRow[]>`
      SELECT id, payload
      FROM outbox_messages
      WHERE published_at IS NULL
      ORDER BY created_at ASC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({ id: row.id, event: row.payload }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE outbox_messages SET published_at = now() WHERE id = ${id}
    `;
  }

  async registerFailure(id: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE outbox_messages SET attempts = attempts + 1 WHERE id = ${id}
    `;
  }
}
