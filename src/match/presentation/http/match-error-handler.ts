import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../../shared/domain/errors/domain.error';
import { MatchNotFoundError } from '../../application/errors/match-not-found.error';
import { MatchStreamCapacityError } from '../../application/errors/match-stream-capacity.error';

/** Schema de params compartilhado: `:id` da partida, string não vazia. */
export const matchIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
};

/** Params tipados das rotas `/matches/:id/...`. */
export interface MatchIdParams {
  readonly id: string;
}

/**
 * Mapeia erros de domínio/aplicação para status HTTP. Compartilhado pelos
 * controllers de ingestão e de stream (cada um registra este handler no seu
 * próprio Fastify).
 */
export function handleMatchError(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply {
  if (error instanceof MatchNotFoundError) {
    return reply.code(404).send({ error: error.name, message: error.message });
  }
  if (error instanceof MatchStreamCapacityError) {
    return reply.code(429).send({ error: error.name, message: error.message });
  }
  if (error instanceof DomainError) {
    return reply.code(422).send({ error: error.name, message: error.message });
  }
  if (typeof error.statusCode === 'number' && error.statusCode < 500) {
    // Erros do próprio Fastify (ex.: validação de schema → 400).
    return reply.code(error.statusCode).send({ error: error.code, message: error.message });
  }
  request.log.error(error);
  return reply.code(500).send({ error: 'InternalServerError', message: 'Erro interno do servidor.' });
}
