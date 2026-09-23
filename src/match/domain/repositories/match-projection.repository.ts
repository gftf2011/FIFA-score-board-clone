import type { MatchEvent, MatchStatus } from '../aggregates/match.aggregate';

/** Credita um gol a um time (dedup pelo id do evento). */
export interface IncrementScoreInput {
  readonly matchId: string;
  readonly teamId: string;
  readonly eventId: string;
}

/** Define o status materializado da partida. */
export interface SetStatusInput {
  readonly matchId: string;
  readonly status: MatchStatus;
}

/**
 * Projeção (read model) da partida no Redis, com operações granulares. Cada
 * operação é idempotente e tolerante a reordenação (via `sequence`/`eventId`),
 * para que o consumidor as combine conforme o tipo do evento.
 */
export interface MatchProjectionRepository {
  /**
   * Comum a todo evento: guarda o evento na linha do tempo (por `sequence`) e
   * atualiza os metadados da partida. Recebe o próprio {@link MatchEvent} — é um
   * armazenamento mecânico, sem interpretação de tipo.
   */
  appendEvent(event: MatchEvent): Promise<void>;
  /** Gol: adiciona o id do evento ao set do time (placar = cardinalidade). */
  incrementScore(input: IncrementScoreInput): Promise<void>;
  /** Ciclo de vida: materializa o status (criado no início da partida). */
  setStatus(input: SetStatusInput): Promise<void>;
}
