/**
 * Agregado raiz de uma partida de futebol.
 *
 * Concentra o estado e as invariantes de uma partida: placar, gols marcados e
 * a linha do tempo de eventos ocorridos. Toda alteração de estado passa por
 * métodos de comportamento, mantendo o placar sempre coerente com os gols.
 */
import type { Competition } from '../entities/competition.entity';
import type { Goal } from '../entities/goal.entity';
import type { Player } from '../entities/player.entity';
import type { Team } from '../entities/team.entity';
import { InvalidMatchOperationError } from '../errors/match-domain.error';

/** Status possíveis de uma partida ao longo do seu ciclo de vida. */
export enum MatchStatus {
  Scheduled = 'SCHEDULED',
  InProgress = 'IN_PROGRESS',
  HalfTime = 'HALF_TIME',
  Finished = 'FINISHED',
}

/** Tipos de evento que podem ocorrer durante uma partida. */
export enum MatchEventType {
  /** Gol. */
  Goal = 'GOAL',
  /** Gol contra. */
  OwnGoal = 'OWN_GOAL',
  /** Pênalti. */
  PenaltyKick = 'PENALTY_KICK',
  /** Disputa de pênaltis (para decidir o vencedor após o empate). */
  PenaltyShootout = 'PENALTY_SHOOTOUT',
  /** Escanteio. */
  CornerKick = 'CORNER_KICK',
  /** Tiro livre / cobrança de falta. */
  FreeKick = 'FREE_KICK',
  /** Falta direta. */
  DirectFreeKick = 'DIRECT_FREE_KICK',
  /** Falta indireta. */
  IndirectFreeKick = 'INDIRECT_FREE_KICK',
  /** Arremesso lateral. */
  ThrowIn = 'THROW_IN',
  /** Tiro de meta. */
  GoalKick = 'GOAL_KICK',
  /** Substituição. */
  Substitution = 'SUBSTITUTION',
  /** Início da partida. */
  MatchStarted = 'MATCH_STARTED',
  /** Encerramento da partida. */
  MatchFinished = 'MATCH_FINISHED',
}

/**
 * Evento ocorrido durante a partida. O `type` é restrito aos tipos de
 * domínio ({@link MatchEventType}), enquanto os demais campos são genéricos,
 * aceitando dados adicionais conforme o tipo do evento (autor, time,
 * jogadores etc.).
 */
export interface MatchEvent {
  readonly type: MatchEventType;
  /** Partida à qual o evento pertence. */
  readonly matchId: string;
  /** Competição da partida à qual o evento pertence. */
  readonly competitionId: string;
  readonly minute: number;
  /** Ordem global de ocorrência do evento na partida (1, 2, 3, ...). */
  readonly sequence: number;
  readonly [key: string]: unknown;
}

/**
 * Dados para adicionar um novo evento. O `minute` não é informado: ele é
 * derivado do relógio da partida (tempo decorrido desde `startedAt`) no momento
 * em que o evento é adicionado.
 */
export interface NewMatchEvent {
  readonly type: MatchEventType;
  readonly [key: string]: unknown;
}

/** Placar de um time na partida: o time e o total de gols marcados. */
export interface TeamScore {
  readonly team: Team;
  goals: number;
}

/** Placar completo da partida (time A e time B). */
export interface MatchScore {
  readonly teamA: TeamScore;
  readonly teamB: TeamScore;
}

/** Dados necessários para criar uma nova partida. */
export interface CreateMatchProps {
  readonly id: string;
  readonly competition: Competition;
  readonly teamA: Team;
  readonly teamB: Team;
}

/** Estado completo da partida, usado para reidratação (ex.: vindo do banco). */
export interface MatchProps {
  readonly id: string;
  readonly competition: Competition;
  readonly status: MatchStatus;
  readonly minute: number;
  /** Momento do início da partida; `null` enquanto não iniciada. */
  readonly startedAt: Date | null;
  /** Momento do encerramento da partida; `null` enquanto não encerrada. */
  readonly finishedAt: Date | null;
  /** Momento da última modificação do agregado. */
  readonly updatedAt: Date;
  /** Último sequence atribuído (topo da pilha de eventos). */
  readonly sequence: number;
  readonly score: MatchScore;
  readonly goals: readonly Goal[];
  readonly events: readonly MatchEvent[];
}

export class Match {
  /** Tipos de evento considerados um "chute" que pode originar um gol. */
  private static readonly KICK_EVENT_TYPES: ReadonlySet<MatchEventType> = new Set([
    MatchEventType.PenaltyKick,
    MatchEventType.PenaltyShootout,
    MatchEventType.FreeKick,
    MatchEventType.DirectFreeKick,
    MatchEventType.IndirectFreeKick,
    MatchEventType.CornerKick,
    MatchEventType.GoalKick,
  ]);

  private _status: MatchStatus;
  private _minute: number;
  private _startedAt: Date | null;
  private _finishedAt: Date | null;
  private _updatedAt: Date;
  private _sequence: number;
  private readonly _score: MatchScore;
  private readonly _goals: Goal[];
  private readonly _events: MatchEvent[];

  private constructor(
    private readonly _id: string,
    private readonly _competition: Competition,
    props: {
      status: MatchStatus;
      minute: number;
      startedAt: Date | null;
      finishedAt: Date | null;
      updatedAt: Date;
      sequence: number;
      score: MatchScore;
      goals: Goal[];
      events: MatchEvent[];
    },
  ) {
    this._status = props.status;
    this._minute = props.minute;
    this._startedAt = props.startedAt;
    this._finishedAt = props.finishedAt;
    this._updatedAt = props.updatedAt;
    this._sequence = props.sequence;
    this._score = props.score;
    this._goals = props.goals;
    this._events = props.events;
  }

  /** Cria uma nova partida agendada, com placar zerado e sem eventos. */
  static create(props: CreateMatchProps): Match {
    if (props.teamA.equals(props.teamB)) {
      throw new InvalidMatchOperationError(
        'Uma partida não pode ter o mesmo time como time A e time B.',
      );
    }

    return new Match(props.id, props.competition, {
      status: MatchStatus.Scheduled,
      minute: 0,
      startedAt: null,
      finishedAt: null,
      updatedAt: new Date(),
      sequence: 0,
      score: {
        teamA: { team: props.teamA, goals: 0 },
        teamB: { team: props.teamB, goals: 0 },
      },
      goals: [],
      events: [],
    });
  }

  /** Reidrata uma partida a partir de um estado previamente persistido. */
  static restore(props: MatchProps): Match {
    return new Match(props.id, props.competition, {
      status: props.status,
      minute: props.minute,
      startedAt: props.startedAt,
      finishedAt: props.finishedAt,
      updatedAt: props.updatedAt,
      sequence: props.sequence,
      score: {
        teamA: { team: props.score.teamA.team, goals: props.score.teamA.goals },
        teamB: { team: props.score.teamB.team, goals: props.score.teamB.goals },
      },
      goals: [...props.goals],
      events: [...props.events],
    });
  }

  get id(): string {
    return this._id;
  }

  get competition(): Competition {
    return this._competition;
  }

  get status(): MatchStatus {
    return this._status;
  }

  get minute(): number {
    return this._minute;
  }

  get startedAt(): Date | null {
    return this._startedAt;
  }

  get finishedAt(): Date | null {
    return this._finishedAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /** Último sequence atribuído (topo da pilha de eventos). */
  get sequence(): number {
    return this._sequence;
  }

  get score(): MatchScore {
    return {
      teamA: { team: this._score.teamA.team, goals: this._score.teamA.goals },
      teamB: { team: this._score.teamB.team, goals: this._score.teamB.goals },
    };
  }

  get goals(): readonly Goal[] {
    return [...this._goals];
  }

  get events(): readonly MatchEvent[] {
    return [...this._events];
  }

  /** Evento no topo da pilha (mais recente), ou `undefined` se não houver. */
  get latestEvent(): MatchEvent | undefined {
    return this._events.at(-1);
  }

  /** Inicia a partida. */
  start(): void {
    if (this._status !== MatchStatus.Scheduled)
      throw new InvalidMatchOperationError('Apenas uma partida agendada pode ser iniciada.');
    const timestamp = new Date();
    this._status = MatchStatus.InProgress;
    this._startedAt = timestamp;
    this._updatedAt = timestamp;
    this.addEvent({ type: MatchEventType.MatchStarted });
  }

  /** Encerra a partida em andamento, registrando o evento de encerramento. */
  finish(): void {
    if (this._status !== MatchStatus.InProgress)
      throw new InvalidMatchOperationError('Apenas uma partida em andamento pode ser encerrada.');
    const timestamp = new Date();
    this._status = MatchStatus.Finished;
    this._finishedAt = timestamp;
    this._updatedAt = timestamp;
    this.addEvent({ type: MatchEventType.MatchFinished });
  }

  /**
   * Registra um gol. O gol deve decorrer de um chute: o evento no topo da pilha
   * precisa ser um evento de chute ({@link Match.KICK_EVENT_TYPES}), e o evento
   * de gol referencia esse chute (`kickType`/`kickSequence`). Atualiza o placar
   * do time correspondente e adiciona o gol à lista.
   */
  registerGoal(goal: Goal): void {
    this.ensureInProgress();

    const kick = this.latestEvent;
    if (kick === undefined || !Match.KICK_EVENT_TYPES.has(kick.type)) {
      throw new InvalidMatchOperationError('Um gol deve ser precedido de um evento de chute.');
    }

    const team = this.resolveTeam(goal.teamId);
    const timestamp = new Date();

    this._updatedAt = timestamp;
    team.goals += 1;
    this._goals.push(goal);
    this.addEvent({
      type: MatchEventType.Goal,
      goalId: goal.id,
      playerId: goal.playerId,
      playerName: goal.playerName,
      teamId: goal.teamId,
    });
  }

  /**
   * Registra um gol contra. Recebe o mesmo {@link Goal} do gol normal, cujo
   * `teamId` é o time do autor; diferente do gol normal, o placar é creditado
   * ao time adversário. Atualiza o placar do beneficiário e adiciona o gol à
   * lista e o evento à linha do tempo.
   */
  registerOwnGoal(goal: Goal): void {
    this.ensureInProgress();

    const beneficiary = this.opposingTeam(goal.teamId);
    beneficiary.goals += 1;
    this._goals.push(goal);
    this.addEvent({
      type: MatchEventType.OwnGoal,
      goalId: goal.id,
      playerId: goal.playerId,
      playerName: goal.playerName,
      teamId: goal.teamId,
      beneficiaryTeamId: beneficiary.team.id,
    });
  }

  /** Registra uma cobrança de pênalti do jogador. */
  registerPenaltyKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.PenaltyKick, player);
  }

  /** Registra uma cobrança na disputa de pênaltis do jogador. */
  registerPenaltyShootout(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.PenaltyShootout, player);
  }

  /** Registra um escanteio cobrado pelo jogador. */
  registerCornerKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.CornerKick, player);
  }

  /** Registra uma cobrança de falta do jogador. */
  registerFreeKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.FreeKick, player);
  }

  /** Registra uma falta direta cometida pelo jogador. */
  registerDirectFreeKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.DirectFreeKick, player);
  }

  /** Registra uma falta indireta cometida pelo jogador. */
  registerIndirectFreeKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.IndirectFreeKick, player);
  }

  /** Registra um arremesso lateral do jogador. */
  registerThrowIn(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.ThrowIn, player);
  }

  /** Registra um tiro de meta do jogador. */
  registerGoalKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerEvent(MatchEventType.GoalKick, player);
  }

  /** Registra uma substituição: jogador que sai e jogador que entra. */
  registerSubstitution(playerOut: Player, playerIn: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.addEvent({
      type: MatchEventType.Substitution,
      playerOutId: playerOut.id,
      playerOutName: playerOut.name,
      playerOutShirtNumber: playerOut.shirtNumber,
      playerInId: playerIn.id,
      playerInName: playerIn.name,
      playerInShirtNumber: playerIn.shirtNumber,
    });
  }

  /**
   * Empilha um evento na linha do tempo da partida (topo = mais recente).
   * Recebe um `sequence` global crescente que preserva a ordem de ocorrência, e
   * a minutagem é derivada do relógio da partida (tempo decorrido desde
   * `startedAt`, em minutos inteiros).
   */
  addEvent(event: NewMatchEvent): void {
    if (this._startedAt === null) {
      throw new InvalidMatchOperationError(
        'Não é possível adicionar eventos a uma partida não iniciada.',
      );
    }
    const minute = this.currentMinute();
    const sequence = ++this._sequence;
    this._minute = minute;
    this._events.push({
      ...event,
      matchId: this._id,
      competitionId: this._competition.id,
      minute,
      sequence,
    });
    this._updatedAt = new Date();
  }

  /** Desempilha o evento do topo (mais recente), ou `undefined` se vazio. */
  popEvent(): MatchEvent | undefined {
    const removed = this._events.pop();
    this._minute = this._events.at(-1)?.minute ?? 0;
    this._updatedAt = new Date();
    return removed;
  }

  /** Garante que a partida esteja em andamento. */
  private ensureInProgress(): void {
    if (this._status !== MatchStatus.InProgress) {
      throw new InvalidMatchOperationError('A partida precisa estar em andamento.');
    }
  }

  /** Adiciona um evento associado a um único jogador. */
  private registerPlayerEvent(type: MatchEventType, player: Player): void {
    this.ensureInProgress();
    this.addEvent({ type, ...Match.playerPayload(player) });
  }

  /** Extrai o payload de identificação de um jogador para um evento. */
  private static playerPayload(player: Player): {
    playerId: string;
    playerName: string;
    shirtNumber: number;
  } {
    return { playerId: player.id, playerName: player.name, shirtNumber: player.shirtNumber };
  }

  /** Minuto atual da partida: tempo decorrido desde `startedAt`, em minutos. */
  private currentMinute(): number {
    if (this._startedAt === null) return 0;
    const elapsedMs = Date.now() - this._startedAt.getTime();
    return Math.max(0, Math.floor(elapsedMs / 60_000));
  }

  private resolveTeam(teamId: string): TeamScore {
    if (teamId === this._score.teamA.team.id) return this._score.teamA;
    if (teamId === this._score.teamB.team.id) return this._score.teamB;
    throw new InvalidMatchOperationError(`Time ${teamId} não participa desta partida.`);
  }

  /** Retorna o placar do time adversário ao informado (valida participação). */
  private opposingTeam(teamId: string): TeamScore {
    this.resolveTeam(teamId);
    return teamId === this._score.teamA.team.id ? this._score.teamB : this._score.teamA;
  }
}
