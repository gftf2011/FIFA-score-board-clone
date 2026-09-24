import type { UseCase } from '../../../shared/application/use-case';
import { MatchEventType, type Match } from '../../domain/aggregates/match.aggregate';
import { Goal } from '../../domain/entities/goal.entity';
import { Player, type PlayerPosition } from '../../domain/entities/player.entity';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';
import type { MatchRepository } from '../../domain/repositories/match.repository';
import { MatchNotFoundError } from '../errors/match-not-found.error';

/** Dados de um jogador envolvidos em um evento. */
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

/** Tipos de evento associados a um único jogador. */
type SinglePlayerEventType =
  | MatchEventType.PenaltyKick
  | MatchEventType.PenaltyShootout
  | MatchEventType.CornerKick
  | MatchEventType.FreeKick
  | MatchEventType.DirectFreeKick
  | MatchEventType.IndirectFreeKick
  | MatchEventType.ThrowIn
  | MatchEventType.GoalKick;

/** Entrada do caso de uso, discriminada pelo tipo de evento. */
export type RegisterMatchEventInput = { readonly matchId: string } & (
  | { readonly type: MatchEventType.Goal | MatchEventType.OwnGoal; readonly goal: GoalData }
  | {
      readonly type: MatchEventType.Substitution;
      readonly playerOut: PlayerData;
      readonly playerIn: PlayerData;
    }
  | { readonly type: SinglePlayerEventType; readonly player: PlayerData }
  | { readonly type: MatchEventType.HalfTime }
);

/**
 * Caso de uso: registra um evento na partida (gol, substituição e demais
 * eventos). Carrega o agregado, delega para o método de domínio correspondente
 * ao tipo, persiste e publica o evento mais recente pelo
 * {@link MatchEventPublisher}. As invariantes (partida em andamento, gol
 * precedido de chute etc.) ficam no próprio agregado.
 */
export class RegisterMatchEventUseCase implements UseCase<RegisterMatchEventInput, void> {
  constructor(
    private readonly matchRepository: MatchRepository,
    private readonly eventPublisher: MatchEventPublisher,
  ) {}

  async execute(input: RegisterMatchEventInput): Promise<void> {
    const match = await this.matchRepository.findById(input.matchId);
    if (match === null) throw new MatchNotFoundError(input.matchId);

    this.apply(match, input);

    await this.matchRepository.update(match);

    const latestEvent = match.latestEvent;
    if (latestEvent !== undefined) await this.eventPublisher.publish(latestEvent);
  }

  private apply(match: Match, input: RegisterMatchEventInput): void {
    switch (input.type) {
      case MatchEventType.Goal:
        match.registerGoal(this.buildGoal(input.goal));
        return;
      case MatchEventType.OwnGoal:
        match.registerOwnGoal(this.buildGoal(input.goal));
        return;
      case MatchEventType.Substitution:
        match.registerSubstitution(
          this.buildPlayer(input.playerOut),
          this.buildPlayer(input.playerIn),
        );
        return;
      case MatchEventType.PenaltyKick:
        match.registerPenaltyKick(this.buildPlayer(input.player));
        return;
      case MatchEventType.PenaltyShootout:
        match.registerPenaltyShootout(this.buildPlayer(input.player));
        return;
      case MatchEventType.CornerKick:
        match.registerCornerKick(this.buildPlayer(input.player));
        return;
      case MatchEventType.FreeKick:
        match.registerFreeKick(this.buildPlayer(input.player));
        return;
      case MatchEventType.DirectFreeKick:
        match.registerDirectFreeKick(this.buildPlayer(input.player));
        return;
      case MatchEventType.IndirectFreeKick:
        match.registerIndirectFreeKick(this.buildPlayer(input.player));
        return;
      case MatchEventType.ThrowIn:
        match.registerThrowIn(this.buildPlayer(input.player));
        return;
      case MatchEventType.GoalKick:
        match.registerGoalKick(this.buildPlayer(input.player));
        return;
      case MatchEventType.HalfTime:
        match.registerHalfTime();
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
