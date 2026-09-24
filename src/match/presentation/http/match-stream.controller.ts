import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { UseCase } from '../../../shared/application/use-case';
import type { SubscribeToMatchEventsInput } from '../../application/use-cases/subscribe-to-match-events.use-case';
import type { UnsubscribeFromMatchEventsInput } from '../../application/use-cases/unsubscribe-from-match-events.use-case';
import type { MatchSnapshot } from '../../domain/aggregates/match-projection.aggregate';
import type { MatchEventListener } from '../../domain/subscribers/match-event.subscriber';
import { handleMatchError, matchIdParamsSchema, type MatchIdParams } from './match-error-handler';

/**
 * Controller HTTP do **stream**: expõe o SSE (`GET /matches/:id/stream`) que
 * envia o snapshot atual e então os eventos ao vivo. A lógica de estado fica nos
 * casos de uso Subscribe/Unsubscribe; aqui é só o transporte SSE. Não conhece a
 * ingestão nem o Postgres.
 */
export class MatchStreamController {
  constructor(
    private readonly subscribeToMatchEvents: UseCase<SubscribeToMatchEventsInput, MatchSnapshot>,
    private readonly unsubscribeFromMatchEvents: UseCase<UnsubscribeFromMatchEventsInput, void>,
  ) {}

  registerRoutes(app: FastifyInstance): void {
    app.setErrorHandler(handleMatchError);
    app.get('/matches/:id/stream', { schema: { params: matchIdParamsSchema } }, this.stream);
  }

  private readonly stream = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as MatchIdParams;

    const send = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const listener: MatchEventListener = (event) => send(event.type, event);

    // Inscreve ANTES de assumir o socket: se o limite de clientes estourar, o
    // erro vira uma resposta HTTP normal (o handleMatchError mapeia para 429).
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
}
