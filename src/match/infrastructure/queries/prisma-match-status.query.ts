import type { PrismaClient } from '@prisma/client';
import type { MatchStatus } from '../../domain/aggregates/match.aggregate';

/** Placar de um lado da partida, já com o nome do time resolvido. */
export interface MatchSideView {
  readonly teamId: string;
  readonly teamName: string;
  readonly teamShortName: string;
  readonly goals: number;
}

/** Status resumido de uma partida — o "agora" de um jogo, pronto para exibir. */
export interface MatchStatusView {
  readonly matchId: string;
  readonly competitionId: string;
  readonly competitionName: string | null;
  readonly status: MatchStatus;
  readonly minute: number;
  readonly startedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly updatedAt: Date;
  readonly home: MatchSideView;
  readonly away: MatchSideView;
  /** Placar textual pronto (ex.: "BRA 2 x 1 ARG"). */
  readonly scoreline: string;
}

/** Linha crua vinda do join de `matches` com `teams`/`competitions`. */
interface MatchStatusRow {
  matchId: string;
  competitionId: string;
  competitionName: string | null;
  status: MatchStatus;
  minute: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
  teamAId: string;
  teamAName: string;
  teamAShortName: string;
  teamAGoals: number;
  teamBId: string;
  teamBName: string;
  teamBShortName: string;
  teamBGoals: number;
}

/** Filtros opcionais para listar partidas. */
export interface ListMatchesFilter {
  readonly status?: MatchStatus;
  readonly competitionId?: string;
}

/**
 * Consultas de leitura (read model) do status das partidas, direto no Postgres
 * via Prisma. É somente-leitura: não altera o estado do jogo, apenas o expõe —
 * a fonte usada pelo MCP server de status.
 */
export class PrismaMatchStatusQuery {
  constructor(private readonly prisma: PrismaClient) {}

  /** Lista as partidas (mais recentes primeiro), opcionalmente filtrando. */
  async list(filter: ListMatchesFilter = {}): Promise<MatchStatusView[]> {
    const rows = await this.prisma.$queryRawUnsafe<MatchStatusRow[]>(
      `${MatchStatusQuery.SELECT}
       WHERE ($1::"MatchStatus" IS NULL OR m.status = $1::"MatchStatus")
         AND ($2::text IS NULL OR m.competition_id = $2)
       ORDER BY m.updated_at DESC`,
      filter.status ?? null,
      filter.competitionId ?? null,
    );
    return rows.map((row) => MatchStatusQuery.toView(row));
  }

  /** Busca o status de uma única partida; `null` se não existir. */
  async findById(matchId: string): Promise<MatchStatusView | null> {
    const rows = await this.prisma.$queryRawUnsafe<MatchStatusRow[]>(
      `${MatchStatusQuery.SELECT} WHERE m.id = $1`,
      matchId,
    );
    const row = rows[0];
    return row ? MatchStatusQuery.toView(row) : null;
  }
}

/** Helpers de SQL/mapeamento, isolados do estado da instância. */
const MatchStatusQuery = {
  SELECT: `
    SELECT
      m.id               AS "matchId",
      m.competition_id   AS "competitionId",
      c.name             AS "competitionName",
      m.status           AS "status",
      m.minute           AS "minute",
      m.started_at       AS "startedAt",
      m.finished_at      AS "finishedAt",
      m.updated_at       AS "updatedAt",
      m.team_a_id        AS "teamAId",
      ta.name            AS "teamAName",
      ta.short_name      AS "teamAShortName",
      m.team_a_goals     AS "teamAGoals",
      m.team_b_id        AS "teamBId",
      tb.name            AS "teamBName",
      tb.short_name      AS "teamBShortName",
      m.team_b_goals     AS "teamBGoals"
    FROM matches m
    LEFT JOIN competitions c ON c.id = m.competition_id
    LEFT JOIN teams ta ON ta.id = m.team_a_id
    LEFT JOIN teams tb ON tb.id = m.team_b_id
  `,

  toView(row: MatchStatusRow): MatchStatusView {
    const home: MatchSideView = {
      teamId: row.teamAId,
      teamName: row.teamAName,
      teamShortName: row.teamAShortName,
      goals: Number(row.teamAGoals),
    };
    const away: MatchSideView = {
      teamId: row.teamBId,
      teamName: row.teamBName,
      teamShortName: row.teamBShortName,
      goals: Number(row.teamBGoals),
    };
    return {
      matchId: row.matchId,
      competitionId: row.competitionId,
      competitionName: row.competitionName,
      status: row.status,
      minute: Number(row.minute),
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      updatedAt: row.updatedAt,
      home,
      away,
      scoreline: `${home.teamShortName} ${home.goals} x ${away.goals} ${away.teamShortName}`,
    };
  },
};
