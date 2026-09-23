import { InvalidMatchOperationError } from '../errors/match-domain.error';
import type { Player } from './player.entity';

/** Dados que identificam e descrevem um time. */
export interface TeamProps {
  readonly id: string;
  readonly name: string;
  /** Sigla / abreviação do time (ex.: "BRA"). */
  readonly shortName: string;
  readonly players: readonly Player[];
}

/**
 * Entidade que representa um time. É distinguida pela sua identidade (`id`),
 * conforme os princípios de DDD (ver {@link Team#equals}). Mantém o elenco de
 * jogadores, garantindo que todo jogador adicionado pertença ao time.
 */
export class Team {
  private readonly _players: Player[];

  private constructor(
    private readonly _id: string,
    private readonly _name: string,
    private readonly _shortName: string,
    players: Player[],
  ) {
    this._players = players;
  }

  /** Cria um novo time, validando as invariantes. */
  static create(props: {
    id: string;
    name: string;
    shortName: string;
    players?: readonly Player[];
  }): Team {
    const name = props.name.trim();
    if (name.length === 0) {
      throw new InvalidMatchOperationError('O nome do time não pode ser vazio.');
    }
    const shortName = props.shortName.trim();
    if (shortName.length === 0) {
      throw new InvalidMatchOperationError('A sigla do time não pode ser vazia.');
    }

    const team = new Team(props.id, name, shortName, []);
    for (const player of props.players ?? []) {
      team.addPlayer(player);
    }
    return team;
  }

  /** Reidrata um time a partir de um estado previamente persistido. */
  static restore(props: TeamProps): Team {
    return new Team(props.id, props.name, props.shortName, [...props.players]);
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get shortName(): string {
    return this._shortName;
  }

  get players(): readonly Player[] {
    return [...this._players];
  }

  /** Adiciona um jogador ao elenco, garantindo que ele pertença ao time. */
  addPlayer(player: Player): void {
    if (player.teamId !== this._id) {
      throw new InvalidMatchOperationError(
        `O jogador ${player.id} não pertence ao time ${this._id}.`,
      );
    }
    if (this._players.some((existing) => existing.equals(player))) {
      throw new InvalidMatchOperationError(`O jogador ${player.id} já está no elenco.`);
    }
    this._players.push(player);
  }

  /** Igualdade por identidade — característica de entidade no DDD. */
  equals(other: Team): boolean {
    return other instanceof Team && other.id === this.id;
  }
}
