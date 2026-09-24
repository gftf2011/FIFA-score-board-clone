import { ApplicationError } from '../../../shared/application/errors/application.error';

/** Erro lançado quando o stream de uma partida atingiu o limite de clientes. */
export class MatchStreamCapacityError extends ApplicationError {
  constructor(matchId: string, limit: number) {
    super(`Stream da partida ${matchId} atingiu o limite de ${limit} clientes.`);
  }
}
