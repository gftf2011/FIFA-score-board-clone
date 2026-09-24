import type { MatchEvent } from '../aggregates/match.aggregate';

/** Ouvinte de eventos de uma partida. */
export type MatchEventListener = (event: MatchEvent) => void;

/** Cancela uma inscrição previamente feita em {@link MatchEventSubscriber}. */
export type Unsubscribe = () => void;

/**
 * Port para consumir os eventos de uma partida em tempo real (ex.: alimentar um
 * stream SSE). É o dual do {@link MatchEventPublisher}: aqui a aplicação se
 * inscreve para receber os eventos que chegam pelo barramento.
 *
 * A implementação concreta (ex.: pub/sub do Redis) vive na infraestrutura.
 */
export interface MatchEventSubscriber {
  /**
   * Inscreve `listener` nos eventos da partida `matchId`. Retorna uma função
   * que cancela a inscrição (deve ser chamada quando o cliente desconecta).
   */
  subscribe(matchId: string, listener: MatchEventListener): Promise<Unsubscribe>;
}
