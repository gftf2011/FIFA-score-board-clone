import {
  PrismaClient,
  type Prisma,
  type CompetitionType,
  type MatchEventType,
} from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Dados de referência — Final da Copa do Mundo FIFA 2022 (Argentina 3 x 3
// França; Argentina campeã nos pênaltis). Elencos, números e posições refletem
// o torneio de 2022. Posições usam os valores de PlayerPosition (GOALKEEPER /
// DEFENDER / MIDFIELDER / FORWARD).
// ---------------------------------------------------------------------------

const COMPETITION: { id: string; name: string; type: CompetitionType } = {
  id: 'wc-2022',
  name: 'Copa do Mundo FIFA 2022',
  type: 'CUP',
};
const ARG = { id: 'arg', name: 'Argentina', shortName: 'ARG' };
const FRA = { id: 'fra', name: 'França', shortName: 'FRA' };
const MATCH_ID = 'wc-2022-final';

type Pos = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD';

const player = (teamId: string, shirtNumber: number, name: string, position: Pos) => ({
  id: `${teamId}-${shirtNumber}`,
  teamId,
  shirtNumber,
  name,
  position,
});

const argentina = [
  player('arg', 23, 'Emiliano Martínez', 'GOALKEEPER'),
  player('arg', 1, 'Franco Armani', 'GOALKEEPER'),
  player('arg', 12, 'Gerónimo Rulli', 'GOALKEEPER'),
  player('arg', 26, 'Nahuel Molina', 'DEFENDER'),
  player('arg', 13, 'Cristian Romero', 'DEFENDER'),
  player('arg', 19, 'Nicolás Otamendi', 'DEFENDER'),
  player('arg', 8, 'Marcos Acuña', 'DEFENDER'),
  player('arg', 3, 'Nicolás Tagliafico', 'DEFENDER'),
  player('arg', 4, 'Gonzalo Montiel', 'DEFENDER'),
  player('arg', 25, 'Lisandro Martínez', 'DEFENDER'),
  player('arg', 2, 'Juan Foyth', 'DEFENDER'),
  player('arg', 6, 'Germán Pezzella', 'DEFENDER'),
  player('arg', 7, 'Rodrigo De Paul', 'MIDFIELDER'),
  player('arg', 24, 'Enzo Fernández', 'MIDFIELDER'),
  player('arg', 20, 'Alexis Mac Allister', 'MIDFIELDER'),
  player('arg', 5, 'Leandro Paredes', 'MIDFIELDER'),
  player('arg', 14, 'Exequiel Palacios', 'MIDFIELDER'),
  player('arg', 18, 'Guido Rodríguez', 'MIDFIELDER'),
  player('arg', 17, 'Alejandro Gómez', 'MIDFIELDER'),
  player('arg', 10, 'Lionel Messi', 'FORWARD'),
  player('arg', 11, 'Ángel Di María', 'FORWARD'),
  player('arg', 9, 'Julián Álvarez', 'FORWARD'),
  player('arg', 22, 'Lautaro Martínez', 'FORWARD'),
  player('arg', 21, 'Paulo Dybala', 'FORWARD'),
  player('arg', 15, 'Ángel Correa', 'FORWARD'),
  player('arg', 16, 'Thiago Almada', 'FORWARD'),
];

const franca = [
  player('fra', 1, 'Hugo Lloris', 'GOALKEEPER'),
  player('fra', 16, 'Steve Mandanda', 'GOALKEEPER'),
  player('fra', 23, 'Alphonse Areola', 'GOALKEEPER'),
  player('fra', 2, 'Benjamin Pavard', 'DEFENDER'),
  player('fra', 4, 'Raphaël Varane', 'DEFENDER'),
  player('fra', 5, 'Jules Koundé', 'DEFENDER'),
  player('fra', 18, 'Dayot Upamecano', 'DEFENDER'),
  player('fra', 22, 'Théo Hernández', 'DEFENDER'),
  player('fra', 21, 'Lucas Hernández', 'DEFENDER'),
  player('fra', 3, 'Axel Disasi', 'DEFENDER'),
  player('fra', 17, 'William Saliba', 'DEFENDER'),
  player('fra', 24, 'Ibrahima Konaté', 'DEFENDER'),
  player('fra', 8, 'Aurélien Tchouaméni', 'MIDFIELDER'),
  player('fra', 14, 'Adrien Rabiot', 'MIDFIELDER'),
  player('fra', 6, 'Eduardo Camavinga', 'MIDFIELDER'),
  player('fra', 13, 'Youssouf Fofana', 'MIDFIELDER'),
  player('fra', 7, 'Antoine Griezmann', 'MIDFIELDER'),
  player('fra', 15, 'Jordan Veretout', 'MIDFIELDER'),
  player('fra', 25, 'Matteo Guendouzi', 'MIDFIELDER'),
  player('fra', 10, 'Kylian Mbappé', 'FORWARD'),
  player('fra', 9, 'Olivier Giroud', 'FORWARD'),
  player('fra', 11, 'Ousmane Dembélé', 'FORWARD'),
  player('fra', 12, 'Randal Kolo Muani', 'FORWARD'),
  player('fra', 26, 'Marcus Thuram', 'FORWARD'),
  player('fra', 20, 'Kingsley Coman', 'FORWARD'),
  player('fra', 19, 'Karim Benzema', 'FORWARD'),
];

const players = [...argentina, ...franca];

// ---------------------------------------------------------------------------
// Linha do tempo da partida (eventos). Gols de pênalti são precedidos pelo
// respectivo PENALTY_KICK, como no modelo de domínio.
// ---------------------------------------------------------------------------

interface SeedEvent {
  sequence: number;
  minute: number;
  type: MatchEventType;
  payload: Prisma.InputJsonValue;
}

const goals = [
  { id: 'goal-1', playerId: 'arg-10', playerName: 'Lionel Messi', teamId: 'arg', minute: 23 },
  { id: 'goal-2', playerId: 'arg-11', playerName: 'Ángel Di María', teamId: 'arg', minute: 36 },
  { id: 'goal-3', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra', minute: 80 },
  { id: 'goal-4', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra', minute: 81 },
  { id: 'goal-5', playerId: 'arg-10', playerName: 'Lionel Messi', teamId: 'arg', minute: 108 },
  { id: 'goal-6', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra', minute: 118 },
];

const events: SeedEvent[] = [
  { sequence: 1, minute: 0, type: 'MATCH_STARTED', payload: {} },
  {
    sequence: 2,
    minute: 23,
    type: 'PENALTY_KICK',
    payload: { playerId: 'arg-10', playerName: 'Lionel Messi', shirtNumber: 10 },
  },
  {
    sequence: 3,
    minute: 23,
    type: 'GOAL',
    payload: {
      goalId: 'goal-1',
      playerId: 'arg-10',
      playerName: 'Lionel Messi',
      teamId: 'arg',
      kickType: 'PENALTY_KICK',
      kickSequence: 2,
    },
  },
  {
    sequence: 4,
    minute: 36,
    type: 'GOAL',
    payload: { goalId: 'goal-2', playerId: 'arg-11', playerName: 'Ángel Di María', teamId: 'arg' },
  },
  {
    sequence: 5,
    minute: 41,
    type: 'SUBSTITUTION',
    payload: {
      playerOutId: 'fra-9',
      playerOutName: 'Olivier Giroud',
      playerOutShirtNumber: 9,
      playerInId: 'fra-12',
      playerInName: 'Randal Kolo Muani',
      playerInShirtNumber: 12,
    },
  },
  {
    sequence: 6,
    minute: 41,
    type: 'SUBSTITUTION',
    payload: {
      playerOutId: 'fra-11',
      playerOutName: 'Ousmane Dembélé',
      playerOutShirtNumber: 11,
      playerInId: 'fra-26',
      playerInName: 'Marcus Thuram',
      playerInShirtNumber: 26,
    },
  },
  {
    sequence: 7,
    minute: 80,
    type: 'PENALTY_KICK',
    payload: { playerId: 'fra-10', playerName: 'Kylian Mbappé', shirtNumber: 10 },
  },
  {
    sequence: 8,
    minute: 80,
    type: 'GOAL',
    payload: {
      goalId: 'goal-3',
      playerId: 'fra-10',
      playerName: 'Kylian Mbappé',
      teamId: 'fra',
      kickType: 'PENALTY_KICK',
      kickSequence: 7,
    },
  },
  {
    sequence: 9,
    minute: 81,
    type: 'GOAL',
    payload: { goalId: 'goal-4', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra' },
  },
  {
    sequence: 10,
    minute: 108,
    type: 'GOAL',
    payload: { goalId: 'goal-5', playerId: 'arg-10', playerName: 'Lionel Messi', teamId: 'arg' },
  },
  {
    sequence: 11,
    minute: 118,
    type: 'PENALTY_KICK',
    payload: { playerId: 'fra-10', playerName: 'Kylian Mbappé', shirtNumber: 10 },
  },
  {
    sequence: 12,
    minute: 118,
    type: 'GOAL',
    payload: {
      goalId: 'goal-6',
      playerId: 'fra-10',
      playerName: 'Kylian Mbappé',
      teamId: 'fra',
      kickType: 'PENALTY_KICK',
      kickSequence: 11,
    },
  },
  { sequence: 13, minute: 120, type: 'MATCH_FINISHED', payload: {} },
];

const startedAt = new Date('2022-12-18T15:00:00.000Z');
const finishedAt = new Date('2022-12-18T17:15:00.000Z');

// Partida agendada (SCHEDULED) para exercitar o fluxo ao vivo pela API:
// `npm run simulate` a dirige (start → eventos → finish).
const SCHEDULED_MATCH_ID = 'wc-2022-semifinal';
const matchIds = [MATCH_ID, SCHEDULED_MATCH_ID];

async function main(): Promise<void> {
  await prisma.$transaction([
    // Limpa dados anteriores do seed (idempotente).
    prisma.matchEvent.deleteMany({ where: { matchId: { in: matchIds } } }),
    prisma.goal.deleteMany({ where: { matchId: { in: matchIds } } }),
    prisma.match.deleteMany({ where: { id: { in: matchIds } } }),
    prisma.player.deleteMany({ where: { teamId: { in: [ARG.id, FRA.id] } } }),
    prisma.team.deleteMany({ where: { id: { in: [ARG.id, FRA.id] } } }),
    prisma.competition.deleteMany({ where: { id: COMPETITION.id } }),

    // Referência.
    prisma.competition.create({ data: COMPETITION }),
    prisma.team.createMany({ data: [ARG, FRA] }),
    prisma.player.createMany({ data: players }),

    // Partida (placar 3 x 3; Argentina campeã nos pênaltis).
    prisma.match.create({
      data: {
        id: MATCH_ID,
        competitionId: COMPETITION.id,
        status: 'FINISHED',
        minute: 120,
        startedAt,
        finishedAt,
        updatedAt: finishedAt,
        sequence: events.length,
        teamAId: ARG.id,
        teamBId: FRA.id,
        teamAGoals: 3,
        teamBGoals: 3,
      },
    }),
    prisma.goal.createMany({ data: goals.map((goal) => ({ ...goal, matchId: MATCH_ID })) }),
    prisma.matchEvent.createMany({
      data: events.map((event) => ({
        id: `${MATCH_ID}-evt-${event.sequence}`,
        matchId: MATCH_ID,
        competitionId: COMPETITION.id,
        sequence: event.sequence,
        type: event.type,
        minute: event.minute,
        payload: event.payload,
      })),
    }),

    // Partida agendada (placar zerado, sem eventos) — pronta para o simulate.
    prisma.match.create({
      data: {
        id: SCHEDULED_MATCH_ID,
        competitionId: COMPETITION.id,
        status: 'SCHEDULED',
        minute: 0,
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
        sequence: 0,
        teamAId: ARG.id,
        teamBId: FRA.id,
        teamAGoals: 0,
        teamBGoals: 0,
      },
    }),
  ]);

  console.log(
    `Seed concluído: ${COMPETITION.name} — ${ARG.name} ${3} x ${3} ${FRA.name} ` +
      `(${MATCH_ID}, FINISHED) + ${SCHEDULED_MATCH_ID} (SCHEDULED); ` +
      `${players.length} jogadores, ${events.length} eventos.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error('Falha no seed', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
