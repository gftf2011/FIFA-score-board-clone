import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UseCase } from '../../../shared/application/use-case';
import type { FinishMatchInput } from '../../application/use-cases/finish-match.use-case';
import type { RegisterMatchEventInput } from '../../application/use-cases/register-match-event.use-case';
import type { StartMatchInput } from '../../application/use-cases/start-match.use-case';
import { MatchEventType } from '../../domain/aggregates/match.aggregate';
import { handleMatchError, matchIdParamsSchema, type MatchIdParams } from './match-error-handler';

/** Tipos de evento que podem ser registrados via HTTP (exclui os de ciclo de vida). */
const registrableEventTypes = Object.values(MatchEventType).filter(
  (type) => type !== MatchEventType.MatchStarted && type !== MatchEventType.MatchFinished,
);

const registerEventBodySchema = {
  type: 'object',
  required: ['type'],
  properties: { type: { type: 'string', enum: registrableEventTypes } },
};

/**
 * Controller HTTP da **ingestão**: recebe os comandos que alteram a partida
 * (início, encerramento e eventos), delegando aos casos de uso que persistem no
 * Postgres e gravam no outbox. Não conhece o stream.
 */
export class MatchIngestionController {
  constructor(
    private readonly startMatch: UseCase<StartMatchInput, void>,
    private readonly finishMatch: UseCase<FinishMatchInput, void>,
    private readonly registerMatchEvent: UseCase<RegisterMatchEventInput, void>,
  ) {}

  registerRoutes(app: FastifyInstance): void {
    app.setErrorHandler(handleMatchError);
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
}
