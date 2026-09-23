import type { Prisma, PrismaClient } from '@prisma/client';
import {
  Match,
  type MatchEvent,
  type MatchEventType,
  type MatchScore,
  type MatchStatus,
} from '../../domain/aggregates/match.aggregate.js';
import { Goal } from '../../domain/entities/goal.entity.js';
import { Team } from '../../domain/entities/team.entity.js';
import type { MatchRepository } from '../../domain/repositories/match.repository.js';

interface MatchRow {
  id: string;
  status: string;
  minute: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
  sequence: number;
  teamAId: string;
  teamBId: string;
  teamAGoals: number;
  teamBGoals: number;
}

interface TeamRow {
  id: string;
  name: string;
  shortName: string;
}

interface GoalRow {
  id: string;
  playerId: string;
  playerName: string;
  teamId: string;
  minute: number;
}

interface EventRow {
  sequence: number;
  type: string;
  minute: number;
  payload: Record<string, unknown> | null;
}

/**
 * Implementação do {@link MatchRepository} sobre PostgreSQL via Prisma, usando
 * raw queries (`$queryRaw`/`$executeRaw`) para todas as operações.
 *
 * Persiste a partida, o placar (desnormalizado), os gols e os events. As
 * linhas de `teams` são de responsabilidade de outro contexto; aqui elas são
 * apenas lidas para reidratar o agregado.
 */
export class PrismaMatchRepository implements MatchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Match | null> {
    const matchRows = await this.prisma.$queryRaw<MatchRow[]>`
      SELECT id, status, minute,
             started_at AS "startedAt", finished_at AS "finishedAt", updated_at AS "updatedAt",
             sequence,
             team_a_id AS "teamAId", team_b_id AS "teamBId",
             team_a_goals AS "teamAGoals", team_b_goals AS "teamBGoals"
      FROM matches
      WHERE id = ${id}
    `;
    const matchRow = matchRows.at(0);
    if (matchRow === undefined) return null;

    const [teamRows, goalRows, eventRows] = await Promise.all([
      this.prisma.$queryRaw<TeamRow[]>`
        SELECT id, name, short_name AS "shortName"
        FROM teams
        WHERE id IN (${matchRow.teamAId}, ${matchRow.teamBId})
      `,
      this.prisma.$queryRaw<GoalRow[]>`
        SELECT id, player_id AS "playerId", player_name AS "playerName", team_id AS "teamId", minute
        FROM goals
        WHERE match_id = ${id}
        ORDER BY minute ASC, id ASC
      `,
      this.prisma.$queryRaw<EventRow[]>`
        SELECT sequence, type, minute, payload
        FROM match_events
        WHERE match_id = ${id}
        ORDER BY sequence ASC
      `,
    ]);

    const score: MatchScore = {
      teamA: { team: this.toTeam(teamRows, matchRow.teamAId), goals: matchRow.teamAGoals },
      teamB: { team: this.toTeam(teamRows, matchRow.teamBId), goals: matchRow.teamBGoals },
    };

    return Match.restore({
      id: matchRow.id,
      status: matchRow.status as MatchStatus,
      minute: matchRow.minute,
      startedAt: matchRow.startedAt,
      finishedAt: matchRow.finishedAt,
      updatedAt: matchRow.updatedAt,
      sequence: matchRow.sequence,
      score,
      goals: goalRows.map((row) =>
        Goal.restore({
          id: row.id,
          playerId: row.playerId,
          playerName: row.playerName,
          teamId: row.teamId,
          minute: row.minute,
        }),
      ),
      events: eventRows.map((row) => this.toEvent(row)),
    });
  }

  async create(match: Match): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.insertMatch(tx, match);
      await this.insertGoals(tx, match);
      await this.insertEvents(tx, match);
    });
  }

  async update(match: Match): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { teamA, teamB } = match.score;
      await tx.$executeRaw`
        UPDATE matches SET
          status = ${match.status},
          minute = ${match.minute},
          started_at = ${match.startedAt},
          finished_at = ${match.finishedAt},
          updated_at = ${match.updatedAt},
          sequence = ${match.sequence},
          team_a_goals = ${teamA.goals},
          team_b_goals = ${teamB.goals}
        WHERE id = ${match.id}
      `;
      await tx.$executeRaw`DELETE FROM goals WHERE match_id = ${match.id}`;
      await tx.$executeRaw`DELETE FROM match_events WHERE match_id = ${match.id}`;
      await this.insertGoals(tx, match);
      await this.insertEvents(tx, match);
    });
  }

  private async insertMatch(tx: Prisma.TransactionClient, match: Match): Promise<void> {
    const { teamA, teamB } = match.score;
    await tx.$executeRaw`
      INSERT INTO matches
        (id, status, minute, started_at, finished_at, updated_at, sequence,
         team_a_id, team_b_id, team_a_goals, team_b_goals)
      VALUES
        (${match.id}, ${match.status}, ${match.minute}, ${match.startedAt}, ${match.finishedAt},
         ${match.updatedAt}, ${match.sequence}, ${teamA.team.id}, ${teamB.team.id},
         ${teamA.goals}, ${teamB.goals})
    `;
  }

  private async insertGoals(tx: Prisma.TransactionClient, match: Match): Promise<void> {
    for (const goal of match.goals) {
      await tx.$executeRaw`
        INSERT INTO goals (id, match_id, player_id, player_name, team_id, minute)
        VALUES (${goal.id}, ${match.id}, ${goal.playerId}, ${goal.playerName}, ${goal.teamId}, ${goal.minute})
      `;
    }
  }

  private async insertEvents(tx: Prisma.TransactionClient, match: Match): Promise<void> {
    for (const event of match.events) {
      const { type, minute, sequence, ...payload } = event;
      await tx.$executeRaw`
        INSERT INTO match_events (match_id, sequence, type, minute, payload)
        VALUES (${match.id}, ${sequence}, ${type}, ${minute}, ${JSON.stringify(payload)}::jsonb)
      `;
    }
  }

  private toTeam(rows: TeamRow[], teamId: string): Team {
    const row = rows.find((candidate) => candidate.id === teamId);
    if (row === undefined) {
      throw new Error(`Time ${teamId} não encontrado ao reidratar a partida.`);
    }
    return Team.restore({ id: row.id, name: row.name, shortName: row.shortName, players: [] });
  }

  private toEvent(row: EventRow): MatchEvent {
    const payload = row.payload ?? {};
    return {
      ...payload,
      type: row.type as MatchEventType,
      minute: row.minute,
      sequence: row.sequence,
    };
  }
}
