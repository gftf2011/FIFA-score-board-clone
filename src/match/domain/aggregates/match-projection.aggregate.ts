import { MatchEventType, MatchStatus, type MatchEvent } from './match.aggregate';

/**
 * Estado atual da partida no read model — o "agora" entregue a quem se conecta
 * no meio do jogo (late joiner) antes de receber os eventos ao vivo. É o DTO
 * imutável de saída produzido por {@link MatchProjection.toSnapshot}.
 */
export interface MatchSnapshot {
  readonly matchId: string;
  /** `null` enquanto nenhum evento de ciclo de vida definiu o status. */
  readonly status: MatchStatus | null;
  readonly competitionId: string | null;
  /** Placar por time: `teamId` → total de gols. */
  readonly goals: Readonly<Record<string, number>>;
  /** Linha do tempo acumulada, em ordem de `sequence`. */
  readonly events: readonly MatchEvent[];
  /** Maior `sequence` já projetado (0 se nenhum evento) — base para deduplicar. */
  readonly lastSequence: number;
}

/**
 * Projeção (read model) da partida, reconstruída a partir dos eventos. Encapsula
 * o estado derivado — status, placar e linha do tempo — e sabe evoluí-lo com
 * {@link MatchProjection.apply}. É a **única** definição de como um evento altera
 * a projeção, usada tanto no cold start (a partir da linha do tempo) quanto ao
 * vivo. Identificada pela partida (`matchId`).
 */
export class MatchProjection {
  private _status: MatchStatus | null = null;
  private _competitionId: string | null = null;
  private readonly _goals: Record<string, number> = {};
  private readonly _events: MatchEvent[] = [];
  private _lastSequence = 0;

  private constructor(private readonly _matchId: string) {}

  /** Projeção vazia para uma partida. */
  static empty(matchId: string): MatchProjection {
    return new MatchProjection(matchId);
  }

  /** Reconstrói a projeção dobrando a linha do tempo. */
  static fromEvents(matchId: string, events: readonly MatchEvent[]): MatchProjection {
    const projection = new MatchProjection(matchId);
    for (const event of events) projection.apply(event);
    return projection;
  }

  /** Maior `sequence` já aplicado — base para deduplicar reentregas. */
  get lastSequence(): number {
    return this._lastSequence;
  }

  /**
   * Aplica um evento à projeção (fold). Idempotente e ordenada por `sequence`.
   *
   * Efeito por tipo: todo evento entra na linha do tempo; gol/gol contra creditam
   * o placar; início/encerramento materializam o status; os demais (falta,
   * escanteio, intervalo, ...) só entram na linha do tempo.
   */
  apply(event: MatchEvent): void {
    if (event.sequence <= this._lastSequence) return; // já aplicado ou fora de ordem

    this._events.push(event);
    this._lastSequence = event.sequence;
    this._competitionId = event.competitionId;

    switch (event.type) {
      case MatchEventType.Goal:
        if (typeof event.teamId === 'string')
          this._goals[event.teamId] = (this._goals[event.teamId] ?? 0) + 1;
        return;
      case MatchEventType.OwnGoal:
        if (typeof event.beneficiaryTeamId === 'string')
          this._goals[event.beneficiaryTeamId] = (this._goals[event.beneficiaryTeamId] ?? 0) + 1;
        return;
      case MatchEventType.MatchStarted:
        this._status = MatchStatus.InProgress;
        return;
      case MatchEventType.MatchFinished:
        this._status = MatchStatus.Finished;
        return;
      default:
        return; // substituição, falta, escanteio, intervalo, ...: só a linha do tempo
    }
  }

  /** DTO imutável do estado atual, pronto para serializar. */
  toSnapshot(): MatchSnapshot {
    return {
      matchId: this._matchId,
      status: this._status,
      competitionId: this._competitionId,
      goals: { ...this._goals },
      events: [...this._events],
      lastSequence: this._lastSequence,
    };
  }
}
