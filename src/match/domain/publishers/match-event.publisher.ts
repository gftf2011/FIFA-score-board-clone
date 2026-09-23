import type { MatchEvent } from '../aggregates/match.aggregate.js';

/**
 * Contrato para publicação de eventos da partida (ex.: barramento de eventos,
 * fila, WebSocket). Faz parte do domínio; a implementação concreta vive na
 * infraestrutura (inversão de dependência).
 */
export interface MatchEventPublisher {
  /** Publica um evento da partida para os interessados. */
  publish(event: MatchEvent): Promise<void>;
}
