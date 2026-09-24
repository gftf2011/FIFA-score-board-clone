import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import { MatchProjection, type MatchSnapshot } from '../../domain/aggregates/match-projection.aggregate';
import type { MatchProjectionRepository } from '../../domain/repositories/match-projection.repository';
import type {
  MatchEventListener,
  MatchEventSubscriber,
  Unsubscribe,
} from '../../domain/subscribers/match-event.subscriber';
import { MatchStreamCapacityError } from '../errors/match-stream-capacity.error';

/** Máximo de clientes simultâneos no stream de uma mesma partida, por instância. */
const MAX_CLIENTS_PER_MATCH = 1000;

/** Entrada por partida: projeção em memória + clientes + assinatura no Redis. */
interface MatchEntry {
  projection: MatchProjection;
  clients: Set<MatchEventListener>;
  unsubscribe: Unsubscribe | null;
  hydration: Promise<void>;
}

/**
 * Estado em memória dos streams por partida. Mantém uma projeção por partida
 * (compartilhada por todos os clientes), alimentada pelo pub/sub. O Redis é lido
 * só uma vez por partida (hidratação a frio); as demais conexões recebem o
 * snapshot da memória. A partida é descartada quando o último cliente sai.
 *
 * Os casos de uso Subscribe/Unsubscribe orquestram este registro.
 */
export class MatchStreamRegistry {
  private readonly entries = new Map<string, MatchEntry>();

  constructor(
    private readonly subscriber: MatchEventSubscriber,
    private readonly projection: MatchProjectionRepository,
  ) {}

  /** Registra um cliente e devolve o snapshot atual da partida. */
  async add(matchId: string, listener: MatchEventListener): Promise<MatchSnapshot> {
    const entry = this.entries.get(matchId) ?? this.create(matchId);
    await entry.hydration;

    if (entry.clients.size >= MAX_CLIENTS_PER_MATCH) throw new MatchStreamCapacityError(matchId, MAX_CLIENTS_PER_MATCH);
    entry.clients.add(listener);

    const snapshot = entry.projection.toSnapshot();
    console.log(
      `[stream] cliente entrou em ${matchId}: ${entry.clients.size} conectado(s); ` +
        `snapshot → ${summary(snapshot)}`,
    );
    return snapshot;
  }

  /** Remove um cliente; descarta a partida quando não sobra ninguém. */
  remove(matchId: string, listener: MatchEventListener): void {
    const entry = this.entries.get(matchId);
    if (entry === undefined) return;
    entry.clients.delete(listener);
    if (entry.clients.size === 0) {
      entry.unsubscribe?.();
      this.entries.delete(matchId);
      console.log(`[stream] cliente saiu de ${matchId}: 0 conectados → partida descartada da memória`);
    } else {
      console.log(`[stream] cliente saiu de ${matchId}: ${entry.clients.size} restante(s)`);
    }
  }

  private create(matchId: string): MatchEntry {
    const entry: MatchEntry = {
      projection: MatchProjection.empty(matchId),
      clients: new Set(),
      unsubscribe: null,
      hydration: Promise.resolve(),
    };
    this.entries.set(matchId, entry);
    entry.hydration = this.hydrate(matchId, entry);
    return entry;
  }

  /**
   * Assina o pub/sub e hidrata a projeção com a linha do tempo do Redis. Os
   * eventos que chegam durante a hidratação aguardam esta promise em {@link
   * MatchStreamRegistry.deliver} e se aplicam depois, em ordem — sem corrida.
   */
  private async hydrate(matchId: string, entry: MatchEntry): Promise<void> {
    entry.unsubscribe = await this.subscriber.subscribe(matchId, (event) => {
      void this.deliver(entry, event);
    });
    const snapshot = await this.projection.loadSnapshot(matchId);
    if (snapshot !== null) for (const event of snapshot.events) entry.projection.apply(event);

    console.log(
      `[stream] hidratado ${matchId} do Redis (${snapshot?.events.length ?? 0} eventos) → ` +
        summary(entry.projection.toSnapshot()),
    );
  }

  /** Aplica o evento à projeção e faz fan-out, ignorando reentregas. */
  private async deliver(entry: MatchEntry, event: MatchEvent): Promise<void> {
    await entry.hydration;
    if (event.sequence <= entry.projection.lastSequence) {
      console.log(
        `[stream] evento ignorado (reentrega) em ${event.matchId}: ${event.type} ` +
          `seq=${event.sequence} <= lastSequence=${entry.projection.lastSequence}`,
      );
      return;
    }
    entry.projection.apply(event);
    console.log(
      `[stream] evento aplicado em ${event.matchId}: ${event.type} seq=${event.sequence} → ` +
        `${summary(entry.projection.toSnapshot())}; fan-out p/ ${entry.clients.size} cliente(s)`,
    );
    for (const listener of entry.clients) listener(event);
  }
}

/** Resumo legível do estado de uma projeção, para logs. */
function summary(snapshot: MatchSnapshot): string {
  return `status=${snapshot.status ?? '—'}, placar=${JSON.stringify(snapshot.goals)}, lastSequence=${snapshot.lastSequence}`;
}
