import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UseCase } from '../../../shared/application/use-case';
import { DomainError } from '../../../shared/domain/errors/domain.error';
import { MatchNotFoundError } from '../../application/errors/match-not-found.error';
import { MatchStreamCapacityError } from '../../application/errors/match-stream-capacity.error';
import type { FinishMatchInput } from '../../application/use-cases/finish-match.use-case';
import type { RegisterMatchEventInput } from '../../application/use-cases/register-match-event.use-case';
import type { StartMatchInput } from '../../application/use-cases/start-match.use-case';
import type { SubscribeToMatchEventsInput } from '../../application/use-cases/subscribe-to-match-events.use-case';
import type { UnsubscribeFromMatchEventsInput } from '../../application/use-cases/unsubscribe-from-match-events.use-case';
import type { MatchSnapshot } from '../../domain/aggregates/match-projection.aggregate';
import { MatchEventType } from '../../domain/aggregates/match.aggregate';
import type { MatchEventListener } from '../../domain/subscribers/match-event.subscriber';

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
 * os casos de uso. Também expõe o stream SSE (`/matches/:id/stream`) e centraliza
 * o mapeamento de erros de domínio / aplicação para status HTTP.
 */
export class MatchController {
  constructor(
    private readonly startMatch: UseCase<StartMatchInput, void>,
    private readonly finishMatch: UseCase<FinishMatchInput, void>,
    private readonly registerMatchEvent: UseCase<RegisterMatchEventInput, void>,
    private readonly subscribeToMatchEvents: UseCase<SubscribeToMatchEventsInput, MatchSnapshot>,
    private readonly unsubscribeFromMatchEvents: UseCase<UnsubscribeFromMatchEventsInput, void>,
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
    app.get('/matches/:id/stream', { schema: { params: matchIdParamsSchema } }, this.stream);
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

  /**
   * Stream SSE dos eventos da partida: envia o `snapshot` atual e então os
   * eventos ao vivo. Toda a lógica de estado/ordenação/dedupe fica nos casos de
   * uso Subscribe/Unsubscribe (que mantêm o estado em memória); aqui é só o
   * transporte SSE.
   */
  private readonly stream = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as MatchIdParams;

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const listener: MatchEventListener = (event) => send(event.type, event);

    // Inscreve ANTES de assumir o socket: se o limite de clientes estourar, o
    // erro vira uma resposta HTTP normal (o handleError mapeia para 429).
    const snapshot = await this.subscribeToMatchEvents.execute({ matchId: id, listener });

    reply.hijack(); // assume o socket: o Fastify não responde por conta própria
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // desliga o buffering em proxies (ex.: nginx)
    });
    send('snapshot', snapshot);

    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      void this.unsubscribeFromMatchEvents.execute({ matchId: id, listener });
    });
  };

  private readonly handleError = (
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
  ): FastifyReply => {
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
    return reply
      .code(500)
      .send({ error: 'InternalServerError', message: 'Erro interno do servidor.' });
  };
}
