/**
 * Agregado raiz de uma partida de futebol.
 *
 * Concentra o estado e as invariantes de uma partida: placar, gols marcados e
 * a linha do tempo de registros ocorridos. Toda alteração de estado passa por
 * métodos de comportamento, mantendo o placar sempre coerente com os gols.
 */
import type { Goal } from '../entities/goal.entity.js';
import type { Player } from '../entities/player.entity.js';
import type { Team } from '../entities/team.entity.js';
import { InvalidMatchOperationError } from '../errors/match-domain.error.js';

/** Status possíveis de uma partida ao longo do seu ciclo de vida. */
export enum MatchStatus {
  Scheduled = 'SCHEDULED',
  InProgress = 'IN_PROGRESS',
  HalfTime = 'HALF_TIME',
  Finished = 'FINISHED',
}

/** Tipos de registro que podem ocorrer durante uma partida. */
export enum MatchRecordType {
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
 * Registro ocorrido durante a partida. O `type` é restrito aos tipos de
 * domínio ({@link MatchRecordType}), enquanto os demais campos são genéricos,
 * aceitando dados adicionais conforme o tipo do registro (autor, time,
 * jogadores etc.).
 */
export interface MatchRecord {
  readonly type: MatchRecordType;
  readonly minute: number;
  /** Ordem global de ocorrência do record na partida (1, 2, 3, ...). */
  readonly sequence: number;
  readonly [key: string]: unknown;
}

/**
 * Dados para adicionar um novo record. O `minute` não é informado: ele é
 * derivado do relógio da partida (tempo decorrido desde `startedAt`) no momento
 * em que o record é adicionado.
 */
export interface NewMatchRecord {
  readonly type: MatchRecordType;
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
  readonly teamA: Team;
  readonly teamB: Team;
}

/** Estado completo da partida, usado para reidratação (ex.: vindo do banco). */
export interface MatchProps {
  readonly id: string;
  readonly status: MatchStatus;
  readonly minute: number;
  /** Momento do início da partida; `null` enquanto não iniciada. */
  readonly startedAt: Date | null;
  /** Momento do encerramento da partida; `null` enquanto não encerrada. */
  readonly finishedAt: Date | null;
  /** Momento da última modificação do agregado. */
  readonly updatedAt: Date;
  /** Último sequence atribuído (topo da pilha de records). */
  readonly sequence: number;
  readonly score: MatchScore;
  readonly goals: readonly Goal[];
  readonly records: readonly MatchRecord[];
}

export class Match {
  /** Tipos de record considerados um "chute" que pode originar um gol. */
  private static readonly KICK_RECORD_TYPES: ReadonlySet<MatchRecordType> = new Set([
    MatchRecordType.PenaltyKick,
    MatchRecordType.PenaltyShootout,
    MatchRecordType.FreeKick,
    MatchRecordType.DirectFreeKick,
    MatchRecordType.IndirectFreeKick,
    MatchRecordType.CornerKick,
    MatchRecordType.GoalKick,
  ]);

  private _status: MatchStatus;
  private _minute: number;
  private _startedAt: Date | null;
  private _finishedAt: Date | null;
  private _updatedAt: Date;
  private _sequence: number;
  private readonly _score: MatchScore;
  private readonly _goals: Goal[];
  private readonly _records: MatchRecord[];

  private constructor(
    private readonly _id: string,
    props: {
      status: MatchStatus;
      minute: number;
      startedAt: Date | null;
      finishedAt: Date | null;
      updatedAt: Date;
      sequence: number;
      score: MatchScore;
      goals: Goal[];
      records: MatchRecord[];
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
    this._records = props.records;
  }

  /** Cria uma nova partida agendada, com placar zerado e sem registros. */
  static create(props: CreateMatchProps): Match {
    if (props.teamA.equals(props.teamB)) {
      throw new InvalidMatchOperationError(
        'Uma partida não pode ter o mesmo time como time A e time B.',
      );
    }

    return new Match(props.id, {
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
      records: [],
    });
  }

  /** Reidrata uma partida a partir de um estado previamente persistido. */
  static restore(props: MatchProps): Match {
    return new Match(props.id, {
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
      records: [...props.records],
    });
  }

  get id(): string {
    return this._id;
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

  /** Último sequence atribuído (topo da pilha de records). */
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

  get records(): readonly MatchRecord[] {
    return [...this._records];
  }

  /** Record no topo da pilha (mais recente), ou `undefined` se não houver. */
  get latestRecord(): MatchRecord | undefined {
    return this._records.at(-1);
  }

  /** Inicia a partida. */
  start(): void {
    if (this._status !== MatchStatus.Scheduled)
      throw new InvalidMatchOperationError('Apenas uma partida agendada pode ser iniciada.');
    const timestamp = new Date();
    this._status = MatchStatus.InProgress;
    this._startedAt = timestamp;
    this._updatedAt = timestamp;
    this.addRecord({ type: MatchRecordType.MatchStarted });
  }

  /** Encerra a partida em andamento, registrando o record de encerramento. */
  finish(): void {
    if (this._status !== MatchStatus.InProgress)
      throw new InvalidMatchOperationError('Apenas uma partida em andamento pode ser encerrada.');
    const timestamp = new Date();
    this._status = MatchStatus.Finished;
    this._finishedAt = timestamp;
    this._updatedAt = timestamp;
    this.addRecord({ type: MatchRecordType.MatchFinished });
  }

  /**
   * Registra um gol. O gol deve decorrer de um chute: o record no topo da pilha
   * precisa ser um record de chute ({@link Match.KICK_RECORD_TYPES}), e o record
   * de gol referencia esse chute (`kickType`/`kickSequence`). Atualiza o placar
   * do time correspondente e adiciona o gol à lista.
   */
  registerGoal(goal: Goal): void {
    this.ensureInProgress();

    const kick = this.latestRecord;
    if (kick === undefined || !Match.KICK_RECORD_TYPES.has(kick.type)) {
      throw new InvalidMatchOperationError('Um gol deve ser precedido de um record de chute.');
    }

    const team = this.resolveTeam(goal.teamId);
    const timestamp = new Date();

    this._updatedAt = timestamp;
    team.goals += 1;
    this._goals.push(goal);
    this.addRecord({
      type: MatchRecordType.Goal,
      goalId: goal.id,
      playerId: goal.playerId,
      playerName: goal.playerName,
      teamId: goal.teamId,
      kickType: kick.type,
      kickSequence: kick.sequence,
    });
  }

  /** Registra um gol contra do jogador. */
  registerOwnGoal(player: Player): void {
    this.ensureInProgress();

    const timestamp = new Date();
    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.OwnGoal, player);
  }

  /** Registra uma cobrança de pênalti do jogador. */
  registerPenaltyKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.PenaltyKick, player);
  }

  /** Registra uma cobrança na disputa de pênaltis do jogador. */
  registerPenaltyShootout(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.PenaltyShootout, player);
  }

  /** Registra um escanteio cobrado pelo jogador. */
  registerCornerKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.CornerKick, player);
  }

  /** Registra uma cobrança de falta do jogador. */
  registerFreeKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.FreeKick, player);
  }

  /** Registra uma falta direta cometida pelo jogador. */
  registerDirectFreeKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.DirectFreeKick, player);
  }

  /** Registra uma falta indireta cometida pelo jogador. */
  registerIndirectFreeKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.IndirectFreeKick, player);
  }

  /** Registra um arremesso lateral do jogador. */
  registerThrowIn(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.ThrowIn, player);
  }

  /** Registra um tiro de meta do jogador. */
  registerGoalKick(player: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.registerPlayerRecord(MatchRecordType.GoalKick, player);
  }

  /** Registra uma substituição: jogador que sai e jogador que entra. */
  registerSubstitution(playerOut: Player, playerIn: Player): void {
    this.ensureInProgress();
    const timestamp = new Date();

    this._updatedAt = timestamp;
    this.addRecord({
      type: MatchRecordType.Substitution,
      playerOutId: playerOut.id,
      playerOutName: playerOut.name,
      playerOutShirtNumber: playerOut.shirtNumber,
      playerInId: playerIn.id,
      playerInName: playerIn.name,
      playerInShirtNumber: playerIn.shirtNumber,
    });
  }

  /**
   * Empilha um registro na linha do tempo da partida (topo = mais recente).
   * Recebe um `sequence` global crescente que preserva a ordem de ocorrência, e
   * a minutagem é derivada do relógio da partida (tempo decorrido desde
   * `startedAt`, em minutos inteiros).
   */
  addRecord(record: NewMatchRecord): void {
    if (this._startedAt === null) {
      throw new InvalidMatchOperationError(
        'Não é possível adicionar registros a uma partida não iniciada.',
      );
    }
    const minute = this.currentMinute();
    const sequence = ++this._sequence;
    this._minute = minute;
    this._records.push({ ...record, minute, sequence });
    this._updatedAt = new Date();
  }

  /** Desempilha o record do topo (mais recente), ou `undefined` se vazio. */
  popRecord(): MatchRecord | undefined {
    const removed = this._records.pop();
    this._minute = this._records.at(-1)?.minute ?? 0;
    this._updatedAt = new Date();
    return removed;
  }

  /** Garante que a partida esteja em andamento. */
  private ensureInProgress(): void {
    if (this._status !== MatchStatus.InProgress) {
      throw new InvalidMatchOperationError('A partida precisa estar em andamento.');
    }
  }

  /** Adiciona um record associado a um único jogador. */
  private registerPlayerRecord(type: MatchRecordType, player: Player): void {
    this.ensureInProgress();
    this.addRecord({ type, ...Match.playerPayload(player) });
  }

  /** Extrai o payload de identificação de um jogador para um record. */
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
}
