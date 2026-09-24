import type Redis from 'ioredis';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type {
  MatchEventListener,
  MatchEventSubscriber,
  Unsubscribe,
} from '../../domain/subscribers/match-event.subscriber';

/** Padrão que casa o canal pub/sub de qualquer partida (ver `matchChannel`). */
const CHANNEL_PATTERN = 'channel:match:*:events';
const CHANNEL_REGEX = /^channel:match:(.+):events$/;

/**
 * Implementação do {@link MatchEventSubscriber} sobre o pub/sub do Redis. Usa
 * uma conexão dedicada (um cliente em modo `psubscribe` não executa outros
 * comandos) e faz `psubscribe` uma única vez no padrão de todas as partidas,
 * roteando cada mensagem para os ouvintes da `matchId` correspondente.
 *
 * Os ouvintes ficam numa lista em memória por partida — é a "lista de clientes
 * a notificar". A cada evento publicado no Redis, todos os ouvintes daquela
 * partida são chamados (fan-out).
 */
export class RedisMatchEventSubscriber implements MatchEventSubscriber {
  private readonly connection: Redis;
  private readonly listeners = new Map<string, Set<MatchEventListener>>();
  private started = false;

  constructor(redis: Redis) {
    this.connection = redis.duplicate();
  }

  async subscribe(matchId: string, listener: MatchEventListener): Promise<Unsubscribe> {
    await this.ensureStarted();

    const listeners = this.listeners.get(matchId) ?? new Set<MatchEventListener>();
    listeners.add(listener);
    this.listeners.set(matchId, listeners);

    return () => {
      const current = this.listeners.get(matchId);
      if (current === undefined) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(matchId);
    };
  }

  /** Estabelece o `psubscribe` e o roteamento por partida na primeira inscrição. */
  private async ensureStarted(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.connection.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const matched = CHANNEL_REGEX.exec(channel);
      const matchId = matched?.[1];
      if (matchId === undefined) return;

      const listeners = this.listeners.get(matchId);
      if (listeners === undefined || listeners.size === 0) return;

      let event: MatchEvent;
      try {
        event = JSON.parse(message) as MatchEvent;
      } catch {
        return; // mensagem malformada: ignora
      }
      for (const listener of listeners) listener(event);
    });

    await this.connection.psubscribe(CHANNEL_PATTERN);
  }
}
