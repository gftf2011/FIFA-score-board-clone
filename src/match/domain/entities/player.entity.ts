import { InvalidMatchOperationError } from '../errors/match-domain.error';

/** Posição do jogador em campo. */
export enum PlayerPosition {
  Goalkeeper = 'GOALKEEPER',
  Defender = 'DEFENDER',
  Midfielder = 'MIDFIELDER',
  Forward = 'FORWARD',
}

/** Dados que identificam e descrevem um jogador. */
export interface PlayerProps {
  readonly id: string;
  readonly name: string;
  readonly teamId: string;
  /** Número da camisa (1 a 99). */
  readonly shirtNumber: number;
  readonly position: PlayerPosition;
}

/**
 * Entidade que representa um jogador. No DDD, uma entidade é distinguida pela
 * sua identidade (`id`) e não pelos seus atributos — por isso a igualdade é
 * comparada via {@link Player#equals}. O estado é encapsulado e criado apenas
 * pelas fábricas, que garantem as invariantes.
 */
export class Player {
  private constructor(private readonly props: PlayerProps) {}

  /** Cria um novo jogador, validando as invariantes. */
  static create(props: PlayerProps): Player {
    const name = props.name.trim();
    if (name.length === 0) {
      throw new InvalidMatchOperationError('O nome do jogador não pode ser vazio.');
    }
    if (!Number.isInteger(props.shirtNumber) || props.shirtNumber < 1 || props.shirtNumber > 99) {
      throw new InvalidMatchOperationError('O número da camisa deve estar entre 1 e 99.');
    }
    return new Player({ ...props, name });
  }

  /** Reidrata um jogador a partir de um estado previamente persistido. */
  static restore(props: PlayerProps): Player {
    return new Player({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get teamId(): string {
    return this.props.teamId;
  }

  get shirtNumber(): number {
    return this.props.shirtNumber;
  }

  get position(): PlayerPosition {
    return this.props.position;
  }

  /** Igualdade por identidade — característica de entidade no DDD. */
  equals(other: Player): boolean {
    return other instanceof Player && other.id === this.id;
  }
}
