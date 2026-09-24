import type { MatchEvent } from '../aggregates/match.aggregate';
import type { MatchSnapshot } from '../aggregates/match-projection.aggregate';

export type { MatchSnapshot };

/**
 * Projeção (read model) da partida no Redis. A linha do tempo de eventos é a
 * única fonte persistida; o estado derivado (status, placar) é reconstruído a
 * partir dela pelo reducer de projeção ({@link applyEvent}). Assim há uma única
 * definição da semântica de projeção, sem duplicação.
 */
export interface MatchProjectionRepository {
  /** Guarda o evento na linha do tempo (por `sequence`, membro único/idempotente). */
  appendEvent(event: MatchEvent): Promise<void>;
  /** Reconstrói o estado atual da partida, ou `null` se não houver eventos ainda. */
  loadSnapshot(matchId: string): Promise<MatchSnapshot | null>;
}
