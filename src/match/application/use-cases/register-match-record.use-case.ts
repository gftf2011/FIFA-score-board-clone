import { MatchRecordType, type Match } from '../../domain/aggregates/match.aggregate.js';
import { Goal } from '../../domain/entities/goal.entity.js';
import { Player, type PlayerPosition } from '../../domain/entities/player.entity.js';
import type { MatchRecordPublisher } from '../../domain/publishers/match-record.publisher.js';
import type { MatchRepository } from '../../domain/repositories/match.repository.js';
import { MatchNotFoundError } from '../errors/match-not-found.error.js';

/** Dados de um jogador envolvidos em um record. */
export interface PlayerData {
  readonly id: string;
  readonly name: string;
  readonly teamId: string;
  readonly shirtNumber: number;
  readonly position: PlayerPosition;
}

/** Dados de um gol. */
export interface GoalData {
  readonly id: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly teamId: string;
  readonly minute: number;
}

/** Tipos de record associados a um único jogador. */
type SinglePlayerRecordType =
  | MatchRecordType.OwnGoal
  | MatchRecordType.PenaltyKick
  | MatchRecordType.PenaltyShootout
  | MatchRecordType.CornerKick
  | MatchRecordType.FreeKick
  | MatchRecordType.DirectFreeKick
  | MatchRecordType.IndirectFreeKick
  | MatchRecordType.ThrowIn
  | MatchRecordType.GoalKick;

/** Entrada do caso de uso, discriminada pelo tipo de record. */
export type RegisterMatchRecordInput = { readonly matchId: string } & (
  | { readonly type: MatchRecordType.Goal; readonly goal: GoalData }
  | {
      readonly type: MatchRecordType.Substitution;
      readonly playerOut: PlayerData;
      readonly playerIn: PlayerData;
    }
  | { readonly type: SinglePlayerRecordType; readonly player: PlayerData }
);

/**
 * Caso de uso: registra um record na partida (gol, substituição e demais
 * eventos). Carrega o agregado, delega para o método de domínio correspondente
 * ao tipo, persiste e publica o record mais recente. As invariantes (partida em
 * andamento, gol precedido de chute etc.) ficam no próprio agregado.
 */
export class RegisterMatchRecordUseCase {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly recordPublisher: MatchRecordPublisher,
  ) {}

  async execute(input: RegisterMatchRecordInput): Promise<void> {
    const match = await this.matchRepository.findById(input.matchId);
    if (match === null) throw new MatchNotFoundError(input.matchId);

    this.apply(match, input);

    await this.matchRepository.update(match);

    const latestRecord = match.latestRecord;
    if (latestRecord !== undefined) await this.recordPublisher.publish(latestRecord);
  }

  private apply(match: Match, input: RegisterMatchRecordInput): void {
    switch (input.type) {
      case MatchRecordType.Goal:
        match.registerGoal(this.buildGoal(input.goal));
        return;
      case MatchRecordType.Substitution:
        match.registerSubstitution(
          this.buildPlayer(input.playerOut),
          this.buildPlayer(input.playerIn),
        );
        return;
      case MatchRecordType.OwnGoal:
        match.registerOwnGoal(this.buildPlayer(input.player));
        return;
      case MatchRecordType.PenaltyKick:
        match.registerPenaltyKick(this.buildPlayer(input.player));
        return;
      case MatchRecordType.PenaltyShootout:
        match.registerPenaltyShootout(this.buildPlayer(input.player));
        return;
      case MatchRecordType.CornerKick:
        match.registerCornerKick(this.buildPlayer(input.player));
        return;
      case MatchRecordType.FreeKick:
        match.registerFreeKick(this.buildPlayer(input.player));
        return;
      case MatchRecordType.DirectFreeKick:
        match.registerDirectFreeKick(this.buildPlayer(input.player));
        return;
      case MatchRecordType.IndirectFreeKick:
        match.registerIndirectFreeKick(this.buildPlayer(input.player));
        return;
      case MatchRecordType.ThrowIn:
        match.registerThrowIn(this.buildPlayer(input.player));
        return;
      case MatchRecordType.GoalKick:
        match.registerGoalKick(this.buildPlayer(input.player));
        return;
    }
  }

  private buildGoal(data: GoalData): Goal {
    return Goal.create({
      id: data.id,
      playerId: data.playerId,
      playerName: data.playerName,
      teamId: data.teamId,
      minute: data.minute,
    });
  }

  private buildPlayer(data: PlayerData): Player {
    return Player.create({
      id: data.id,
      name: data.name,
      teamId: data.teamId,
      shirtNumber: data.shirtNumber,
      position: data.position,
    });
  }
}
