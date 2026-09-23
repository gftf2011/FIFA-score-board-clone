import type { Match } from '../aggregates/match.aggregate';

/**
 * Contrato de persistência do agregado {@link Match}. Faz parte do domínio; a
 * implementação concreta vive na infraestrutura (inversão de dependência).
 */
export interface MatchRepository {
  /** Busca uma partida pelo seu identificador; retorna `null` se não existir. */
  findById(id: string): Promise<Match | null>;

  /** Persiste uma partida nova. */
  create(match: Match): Promise<void>;

  /** Atualiza o estado de uma partida já existente. */
  update(match: Match): Promise<void>;
}
