import { InvalidMatchOperationError } from '../errors/match-domain.error';

/** Categoria/formato geral da competição. */
export enum CompetitionType {
  /** Pontos corridos (ex.: Brasileirão). */
  League = 'LEAGUE',
  /** Torneio eliminatório / copa (ex.: Copa do Mundo). */
  Cup = 'CUP',
}

/** Dados que identificam e descrevem uma competição. */
export interface CompetitionProps {
  readonly id: string;
  readonly name: string;
  readonly type: CompetitionType;
}

/**
 * Entidade que representa a competição à qual uma partida pertence (ex.: Copa
 * do Mundo, Brasileirão). Distinguida pela identidade (`id`), conforme DDD.
 * Serve para classificar/diferenciar as partidas entre torneios.
 */
export class Competition {
  private constructor(private readonly props: CompetitionProps) {}

  /** Cria uma nova competição, validando as invariantes. */
  static create(props: CompetitionProps): Competition {
    const name = props.name.trim();
    if (name.length === 0) {
      throw new InvalidMatchOperationError('O nome da competição não pode ser vazio.');
    }
    return new Competition({ ...props, name });
  }

  /** Reidrata uma competição a partir de um estado previamente persistido. */
  static restore(props: CompetitionProps): Competition {
    return new Competition({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): CompetitionType {
    return this.props.type;
  }

  /** Igualdade por identidade — característica de entidade no DDD. */
  equals(other: Competition): boolean {
    return other instanceof Competition && other.id === this.id;
  }
}
