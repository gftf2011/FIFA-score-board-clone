import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UseCase } from '../../../shared/application/use-case.js';
import { DomainError } from '../../../shared/domain/errors/domain.error.js';
import { MatchNotFoundError } from '../../application/errors/match-not-found.error.js';
import type { FinishMatchInput } from '../../application/use-cases/finish-match.use-case.js';
import type { RegisterMatchEventInput } from '../../application/use-cases/register-match-event.use-case.js';
import type { StartMatchInput } from '../../application/use-cases/start-match.use-case.js';
import { MatchEventType } from '../../domain/aggregates/match.aggregate.js';

interface MatchIdParams {
  readonly id: string;
}

/** Tipos de evento que podem ser registrados via HTTP (exclui os de ciclo de vida). */
const registrableEventTypes = Object.values(MatchEventType).filter(
  (type) => type !== MatchEventType.MatchStarted && type !== MatchEventType.MatchFinished,
);

const matchIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
};

const registerEventBodySchema = {
  type: 'object',
  required: ['type'],
  properties: { type: { type: 'string', enum: registrableEventTypes } },
};

/**
 * Controller HTTP (Fastify) que centraliza as rotas de partida, delegando para
 * os três casos de uso. Também centraliza o mapeamento de erros de domínio /
 * aplicação para status HTTP.
 */
export class MatchController {
  constructor(
    private readonly startMatch: UseCase<StartMatchInput, void>,
    private readonly finishMatch: UseCase<FinishMatchInput, void>,
    private readonly registerMatchEvent: UseCase<RegisterMatchEventInput, void>,
  ) {}

  /** Registra as rotas e o error handler na instância do Fastify. */
  registerRoutes(app: FastifyInstance): void {
    app.setErrorHandler(this.handleError);
    app.post('/matches/:id/start', { schema: { params: matchIdParamsSchema } }, this.start);
    app.post('/matches/:id/finish', { schema: { params: matchIdParamsSchema } }, this.finish);
    app.post(
      '/matches/:id/events',
      { schema: { params: matchIdParamsSchema, body: registerEventBodySchema } },
      this.registerEvent,
    );
  }

  private readonly start = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const { id } = request.params as MatchIdParams;
    await this.startMatch.execute({ matchId: id });
    return reply.code(204).send();
  };

  private readonly finish = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const { id } = request.params as MatchIdParams;
    await this.finishMatch.execute({ matchId: id });
    return reply.code(204).send();
  };

  private readonly registerEvent = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const { id } = request.params as MatchIdParams;
    const body = request.body as Record<string, unknown>;
    // A validação fina (jogador, chute etc.) é feita pelo domínio; o schema
    // garante apenas um `type` válido.
    const input = { ...body, matchId: id } as unknown as RegisterMatchEventInput;
    await this.registerMatchEvent.execute(input);
    return reply.code(204).send();
  };

  private readonly handleError = (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ): FastifyReply => {
    if (error instanceof MatchNotFoundError) {
      return reply.code(404).send({ error: error.name, message: error.message });
    }
    if (error instanceof DomainError) {
      return reply.code(422).send({ error: error.name, message: error.message });
    }
    if (typeof error.statusCode === 'number' && error.statusCode < 500) {
      // Erros do próprio Fastify (ex.: validação de schema → 400).
      return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    }
    request.log.error(error);
    return reply
      .code(500)
      .send({ error: 'InternalServerError', message: 'Erro interno do servidor.' });
  };
}
