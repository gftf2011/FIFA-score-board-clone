import type { MatchRecord } from '../aggregates/match.aggregate.js';

/**
 * Contrato para publicação de records da partida (ex.: barramento de eventos,
 * fila, WebSocket). Faz parte do domínio; a implementação concreta vive na
 * infraestrutura (inversão de dependência).
 */
export interface MatchRecordPublisher {
  /** Publica um record da partida para os interessados. */
  publish(record: MatchRecord): Promise<void>;
}
