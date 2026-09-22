import { InvalidMatchOperationError } from '../errors/match-domain.error.js';

/** Dados que identificam e descrevem um gol. */
export interface GoalProps {
  readonly id: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly teamId: string;
  /** Minutagem em que o gol ocorreu. */
  readonly minute: number;
}

/**
 * Entidade que representa um gol marcado durante a partida. Possui identidade
 * própria (`id`) e é referenciada pelo agregado {@link Match}.
 */
export class Goal {
  private constructor(private readonly props: GoalProps) {}

  static create(props: GoalProps): Goal {
    if (!Number.isInteger(props.minute) || props.minute < 0) {
      throw new InvalidMatchOperationError('A minutagem do gol deve ser um inteiro não negativo.');
    }
    return new Goal({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get playerId(): string {
    return this.props.playerId;
  }

  get playerName(): string {
    return this.props.playerName;
  }

  get teamId(): string {
    return this.props.teamId;
  }

  get minute(): number {
    return this.props.minute;
  }
}
