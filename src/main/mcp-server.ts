import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MatchStatus } from '../match/domain/aggregates/match.aggregate';
import {
  PrismaMatchStatusQuery,
  type MatchStatusView,
} from '../match/infrastructure/queries/prisma-match-status.query';
import { prisma } from '../shared/infrastructure/prisma/prisma-client';

/**
 * MCP server (stdio) de STATUS: expõe o placar clone como ferramentas para um
 * agente consultar o "agora" dos jogos — listar partidas e ver o status de uma.
 * É somente-leitura: lê o read model no Postgres via {@link PrismaMatchStatusQuery}
 * e não altera nenhum estado da partida.
 */
const query = new PrismaMatchStatusQuery(prisma);

/** Valores válidos de status, expostos como enum no schema das ferramentas. */
const statusValues = Object.values(MatchStatus);

/** Serializa a view para JSON estável (Date → ISO). */
function serialize(view: MatchStatusView): Record<string, unknown> {
  return {
    ...view,
    startedAt: view.startedAt?.toISOString() ?? null,
    finishedAt: view.finishedAt?.toISOString() ?? null,
    updatedAt: view.updatedAt.toISOString(),
  };
}

/** Empacota um payload como conteúdo de texto (JSON) esperado pelo MCP. */
function jsonContent(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

const server = new Server(
  { name: 'fifa-score-board', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: 'list_matches',
      description:
        'Lista as partidas do placar (mais recentes primeiro) com status, minuto e placar. ' +
        'Pode filtrar por status e/ou competição.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: statusValues,
            description: 'Filtra pelo status da partida.',
          },
          competitionId: {
            type: 'string',
            description: 'Filtra pelas partidas de uma competição.',
          },
        },
      },
    },
    {
      name: 'get_match_status',
      description:
        'Retorna o status atual de uma partida específica (placar, minuto, times, competição).',
      inputSchema: {
        type: 'object',
        required: ['matchId'],
        properties: {
          matchId: { type: 'string', description: 'Identificador da partida.' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === 'list_matches') {
    const status = args.status as MatchStatus | undefined;
    const competitionId = args.competitionId as string | undefined;
    const matches = await query.list({ status, competitionId });
    return jsonContent({ count: matches.length, matches: matches.map(serialize) });
  }

  if (name === 'get_match_status') {
    const matchId = args.matchId as string | undefined;
    if (!matchId) {
      return { isError: true, content: [{ type: 'text', text: 'matchId é obrigatório.' }] };
    }
    const match = await query.findById(matchId);
    if (!match) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Partida não encontrada: ${matchId}` }],
      };
    }
    return jsonContent(serialize(match));
  }

  return { isError: true, content: [{ type: 'text', text: `Ferramenta desconhecida: ${name}` }] };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log no stderr: o stdout é reservado para o protocolo MCP (JSON-RPC).
  console.error('FIFA score board MCP server pronto (stdio).');

  const shutdown = async (): Promise<void> => {
    await server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
