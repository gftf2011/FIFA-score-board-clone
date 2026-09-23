import { ApplicationError } from '../../../shared/application/errors/application.error';

/** Erro lançado quando a partida informada não é encontrada. */
export class MatchNotFoundError extends ApplicationError {
  constructor(matchId: string) {
    super(`Partida ${matchId} não encontrada.`);
  }
}
