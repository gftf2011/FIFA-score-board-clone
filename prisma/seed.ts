import {
  PrismaClient,
  type Prisma,
  type CompetitionType,
  type PlayerPosition,
} from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Copa do Mundo FIFA 2022 (Catar) — todas as 64 partidas.
//
// Os CONFRONTOS e PLACARES são reais. Os elencos de Argentina e França são
// reais (números/posições do torneio); as demais 30 seleções têm elencos
// GERADOS (26 jogadores, posições/números plausíveis, nomes-placeholder). Os
// GOLS das partidas geradas são atribuídos a um atacante da seleção que marcou,
// com minuto sintético — servem para dar volume e casar com o placar, não para
// refletir os artilheiros reais. A final (Argentina 3 x 3 França) é mantida
// como showcase, com gols/eventos reais. Há ainda uma partida SCHEDULED
// sintética (Argentina x França) que o `npm run simulate` dirige.
// ---------------------------------------------------------------------------

const COMPETITION: { id: string; name: string; type: CompetitionType } = {
  id: 'wc-2022',
  name: 'Copa do Mundo FIFA 2022',
  type: 'CUP',
};

type Pos = PlayerPosition;

const player = (teamId: string, shirtNumber: number, name: string, position: Pos) => ({
  id: `${teamId}-${shirtNumber}`,
  teamId,
  shirtNumber,
  name,
  position,
});

interface TeamRef {
  id: string;
  name: string;
  shortName: string;
}

// As 32 seleções, por grupo (A→H).
const TEAMS: TeamRef[] = [
  { id: 'qat', name: 'Catar', shortName: 'QAT' },
  { id: 'ecu', name: 'Equador', shortName: 'ECU' },
  { id: 'sen', name: 'Senegal', shortName: 'SEN' },
  { id: 'ned', name: 'Países Baixos', shortName: 'NED' },
  { id: 'eng', name: 'Inglaterra', shortName: 'ENG' },
  { id: 'irn', name: 'Irã', shortName: 'IRN' },
  { id: 'usa', name: 'Estados Unidos', shortName: 'USA' },
  { id: 'wal', name: 'País de Gales', shortName: 'WAL' },
  { id: 'arg', name: 'Argentina', shortName: 'ARG' },
  { id: 'ksa', name: 'Arábia Saudita', shortName: 'KSA' },
  { id: 'mex', name: 'México', shortName: 'MEX' },
  { id: 'pol', name: 'Polônia', shortName: 'POL' },
  { id: 'fra', name: 'França', shortName: 'FRA' },
  { id: 'aus', name: 'Austrália', shortName: 'AUS' },
  { id: 'den', name: 'Dinamarca', shortName: 'DEN' },
  { id: 'tun', name: 'Tunísia', shortName: 'TUN' },
  { id: 'esp', name: 'Espanha', shortName: 'ESP' },
  { id: 'crc', name: 'Costa Rica', shortName: 'CRC' },
  { id: 'ger', name: 'Alemanha', shortName: 'GER' },
  { id: 'jpn', name: 'Japão', shortName: 'JPN' },
  { id: 'bel', name: 'Bélgica', shortName: 'BEL' },
  { id: 'can', name: 'Canadá', shortName: 'CAN' },
  { id: 'mar', name: 'Marrocos', shortName: 'MAR' },
  { id: 'cro', name: 'Croácia', shortName: 'CRO' },
  { id: 'bra', name: 'Brasil', shortName: 'BRA' },
  { id: 'srb', name: 'Sérvia', shortName: 'SRB' },
  { id: 'sui', name: 'Suíça', shortName: 'SUI' },
  { id: 'cmr', name: 'Camarões', shortName: 'CMR' },
  { id: 'por', name: 'Portugal', shortName: 'POR' },
  { id: 'gha', name: 'Gana', shortName: 'GHA' },
  { id: 'uru', name: 'Uruguai', shortName: 'URU' },
  { id: 'kor', name: 'Coreia do Sul', shortName: 'KOR' },
];

// Elencos reais de Argentina e França (números/posições do torneio de 2022).
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

// Elenco gerado (placeholder) para as demais seleções: 26 jogadores, números
// 1–26, posições por faixa (3 GK, 8 DEF, 8 MID, 7 FWD).
function positionForShirt(shirt: number): Pos {
  if (shirt <= 3) return 'GOALKEEPER';
  if (shirt <= 11) return 'DEFENDER';
  if (shirt <= 19) return 'MIDFIELDER';
  return 'FORWARD';
}

function generateSquad(team: TeamRef): ReturnType<typeof player>[] {
  return Array.from({ length: 26 }, (_, i) => {
    const shirt = i + 1;
    return player(team.id, shirt, `${team.name} ${shirt}`, positionForShirt(shirt));
  });
}

const squads = new Map<string, ReturnType<typeof player>[]>();
for (const team of TEAMS) {
  const squad = team.id === 'arg' ? argentina : team.id === 'fra' ? franca : generateSquad(team);
  squads.set(team.id, squad);
}
const players = [...squads.values()].flat();

const forwardsOf = (teamId: string): ReturnType<typeof player>[] =>
  (squads.get(teamId) ?? []).filter((p) => p.position === 'FORWARD');

// ---------------------------------------------------------------------------
// Final (showcase) — Argentina 3 x 3 França, com gols/eventos reais.
// ---------------------------------------------------------------------------

const FINAL_ID = 'wc-2022-final';

interface SeedEvent {
  sequence: number;
  minute: number;
  type: Prisma.MatchEventCreateManyInput['type'];
  payload: Prisma.InputJsonValue;
}

const finalGoals = [
  { id: 'goal-1', playerId: 'arg-10', playerName: 'Lionel Messi', teamId: 'arg', minute: 23 },
  { id: 'goal-2', playerId: 'arg-11', playerName: 'Ángel Di María', teamId: 'arg', minute: 36 },
  { id: 'goal-3', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra', minute: 80 },
  { id: 'goal-4', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra', minute: 81 },
  { id: 'goal-5', playerId: 'arg-10', playerName: 'Lionel Messi', teamId: 'arg', minute: 108 },
  { id: 'goal-6', playerId: 'fra-10', playerName: 'Kylian Mbappé', teamId: 'fra', minute: 118 },
];

const finalEvents: SeedEvent[] = [
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

// ---------------------------------------------------------------------------
// Confrontos gerados (FINISHED) — placares reais. Exclui apenas a final, que é
// mantida à parte como showcase (gols/eventos reais).
// Tuplas: [id, teamA, golsA, teamB, golsB].
// ---------------------------------------------------------------------------

type Fixture = [id: string, a: string, ga: number, b: string, gb: number];

const FIXTURES: Fixture[] = [
  // Grupo A
  ['wc-2022-m01', 'qat', 0, 'ecu', 2],
  ['wc-2022-m02', 'sen', 0, 'ned', 2],
  ['wc-2022-m03', 'qat', 1, 'sen', 3],
  ['wc-2022-m04', 'ned', 1, 'ecu', 1],
  ['wc-2022-m05', 'ecu', 1, 'sen', 2],
  ['wc-2022-m06', 'ned', 2, 'qat', 0],
  // Grupo B
  ['wc-2022-m07', 'eng', 6, 'irn', 2],
  ['wc-2022-m08', 'usa', 1, 'wal', 1],
  ['wc-2022-m09', 'wal', 0, 'irn', 2],
  ['wc-2022-m10', 'eng', 0, 'usa', 0],
  ['wc-2022-m11', 'wal', 0, 'eng', 3],
  ['wc-2022-m12', 'irn', 0, 'usa', 1],
  // Grupo C
  ['wc-2022-m13', 'arg', 1, 'ksa', 2],
  ['wc-2022-m14', 'mex', 0, 'pol', 0],
  ['wc-2022-m15', 'pol', 2, 'ksa', 0],
  ['wc-2022-m16', 'arg', 2, 'mex', 0],
  ['wc-2022-m17', 'pol', 0, 'arg', 2],
  ['wc-2022-m18', 'ksa', 1, 'mex', 2],
  // Grupo D
  ['wc-2022-m19', 'den', 0, 'tun', 0],
  ['wc-2022-m20', 'fra', 4, 'aus', 1],
  ['wc-2022-m21', 'tun', 0, 'aus', 1],
  ['wc-2022-m22', 'fra', 2, 'den', 1],
  ['wc-2022-m23', 'aus', 1, 'den', 0],
  ['wc-2022-m24', 'tun', 1, 'fra', 0],
  // Grupo E
  ['wc-2022-m25', 'ger', 1, 'jpn', 2],
  ['wc-2022-m26', 'esp', 7, 'crc', 0],
  ['wc-2022-m27', 'jpn', 0, 'crc', 1],
  ['wc-2022-m28', 'esp', 1, 'ger', 1],
  ['wc-2022-m29', 'jpn', 2, 'esp', 1],
  ['wc-2022-m30', 'crc', 2, 'ger', 4],
  // Grupo F
  ['wc-2022-m31', 'mar', 0, 'cro', 0],
  ['wc-2022-m32', 'bel', 1, 'can', 0],
  ['wc-2022-m33', 'bel', 0, 'mar', 2],
  ['wc-2022-m34', 'cro', 4, 'can', 1],
  ['wc-2022-m35', 'cro', 0, 'bel', 0],
  ['wc-2022-m36', 'can', 1, 'mar', 2],
  // Grupo G
  ['wc-2022-m37', 'sui', 1, 'cmr', 0],
  ['wc-2022-m38', 'bra', 2, 'srb', 0],
  ['wc-2022-m39', 'cmr', 3, 'srb', 3],
  ['wc-2022-m40', 'bra', 1, 'sui', 0],
  ['wc-2022-m41', 'srb', 2, 'sui', 3],
  ['wc-2022-m42', 'cmr', 1, 'bra', 0],
  // Grupo H
  ['wc-2022-m43', 'uru', 0, 'kor', 0],
  ['wc-2022-m44', 'por', 3, 'gha', 2],
  ['wc-2022-m45', 'kor', 2, 'gha', 3],
  ['wc-2022-m46', 'por', 2, 'uru', 0],
  ['wc-2022-m47', 'gha', 0, 'uru', 2],
  ['wc-2022-m48', 'kor', 2, 'por', 1],
  // Oitavas
  ['wc-2022-r16-1', 'ned', 3, 'usa', 1],
  ['wc-2022-r16-2', 'arg', 2, 'aus', 1],
  ['wc-2022-r16-3', 'fra', 3, 'pol', 1],
  ['wc-2022-r16-4', 'eng', 3, 'sen', 0],
  ['wc-2022-r16-5', 'jpn', 1, 'cro', 1], // Croácia venceu nos pênaltis
  ['wc-2022-r16-6', 'bra', 4, 'kor', 1],
  ['wc-2022-r16-7', 'mar', 0, 'esp', 0], // Marrocos venceu nos pênaltis
  ['wc-2022-r16-8', 'por', 6, 'sui', 1],
  // Quartas
  ['wc-2022-qf-1', 'cro', 1, 'bra', 1], // Croácia venceu nos pênaltis
  ['wc-2022-qf-2', 'ned', 2, 'arg', 2], // Argentina venceu nos pênaltis
  ['wc-2022-qf-3', 'mar', 1, 'por', 0],
  ['wc-2022-qf-4', 'eng', 1, 'fra', 2],
  // Semifinais
  ['wc-2022-sf-1', 'arg', 3, 'cro', 0],
  ['wc-2022-sf-2', 'fra', 2, 'mar', 0],
  // Disputa de terceiro lugar
  ['wc-2022-third', 'cro', 2, 'mar', 1],
];

// Partida SCHEDULED de demonstração (Argentina x França) que o `npm run
// simulate` dirige — os eventos do script referenciam jogadores dessas duas
// seleções (elencos reais). É um confronto sintético só para o fluxo ao vivo.
const SCHEDULED_MATCH_ID = 'wc-2022-semifinal';

// ---------------------------------------------------------------------------
// Montagem das linhas (matches, goals, match_events) a partir dos confrontos.
// ---------------------------------------------------------------------------

const matchRows: Prisma.MatchCreateManyInput[] = [];
const goalRows: Prisma.GoalCreateManyInput[] = [];
const eventRows: Prisma.MatchEventCreateManyInput[] = [];

// Minuto sintético do i-ésimo gol (de n), espalhado ao longo dos 90 minutos.
const goalMinute = (i: number, n: number): number => Math.min(90, Math.round(((i + 1) / (n + 1)) * 88) + 2);

const GROUP_STAGE_START = Date.UTC(2022, 10, 20); // 20/11/2022

for (const [index, [id, teamA, ga, teamB, gb]] of FIXTURES.entries()) {
  const kickoff = new Date(GROUP_STAGE_START + index * 12 * 60 * 60 * 1000);
  const finished = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);

  // Gera os gols (atacante da seleção que marcou) e ordena por minuto.
  const scored: { teamId: string; scorer: ReturnType<typeof player> }[] = [];
  const push = (teamId: string, count: number): void => {
    const forwards = forwardsOf(teamId);
    if (forwards.length === 0) throw new Error(`Seleção ${teamId} sem atacantes para atribuir gols.`);
    for (let k = 0; k < count; k += 1) {
      const scorer = forwards[k % forwards.length];
      if (scorer !== undefined) scored.push({ teamId, scorer });
    }
  };
  push(teamA, ga);
  push(teamB, gb);

  const total = scored.length;
  const matchGoals = scored.map((entry, i) => ({
    id: `${id}-g${i + 1}`,
    matchId: id,
    playerId: entry.scorer.id,
    playerName: entry.scorer.name,
    teamId: entry.teamId,
    minute: goalMinute(i, total),
  }));
  matchGoals.sort((a, b) => a.minute - b.minute);

  let sequence = 1;
  eventRows.push({
    id: `${id}-evt-${sequence}`,
    matchId: id,
    competitionId: COMPETITION.id,
    sequence,
    type: 'MATCH_STARTED',
    minute: 0,
    payload: {},
  });
  for (const goal of matchGoals) {
    sequence += 1;
    eventRows.push({
      id: `${id}-evt-${sequence}`,
      matchId: id,
      competitionId: COMPETITION.id,
      sequence,
      type: 'GOAL',
      minute: goal.minute,
      payload: {
        goalId: goal.id,
        playerId: goal.playerId,
        playerName: goal.playerName,
        teamId: goal.teamId,
      },
    });
  }
  sequence += 1;
  eventRows.push({
    id: `${id}-evt-${sequence}`,
    matchId: id,
    competitionId: COMPETITION.id,
    sequence,
    type: 'MATCH_FINISHED',
    minute: 90,
    payload: {},
  });

  goalRows.push(...matchGoals);
  matchRows.push({
    id,
    competitionId: COMPETITION.id,
    status: 'FINISHED',
    minute: 90,
    startedAt: kickoff,
    finishedAt: finished,
    updatedAt: finished,
    sequence,
    teamAId: teamA,
    teamBId: teamB,
    teamAGoals: ga,
    teamBGoals: gb,
  });
}

// Final showcase (gols/eventos reais).
const finalStartedAt = new Date('2022-12-18T15:00:00.000Z');
const finalFinishedAt = new Date('2022-12-18T17:15:00.000Z');
matchRows.push({
  id: FINAL_ID,
  competitionId: COMPETITION.id,
  status: 'FINISHED',
  minute: 120,
  startedAt: finalStartedAt,
  finishedAt: finalFinishedAt,
  updatedAt: finalFinishedAt,
  sequence: finalEvents.length,
  teamAId: 'arg',
  teamBId: 'fra',
  teamAGoals: 3,
  teamBGoals: 3,
});
goalRows.push(...finalGoals.map((goal) => ({ ...goal, matchId: FINAL_ID })));
eventRows.push(
  ...finalEvents.map((event) => ({
    id: `${FINAL_ID}-evt-${event.sequence}`,
    matchId: FINAL_ID,
    competitionId: COMPETITION.id,
    sequence: event.sequence,
    type: event.type,
    minute: event.minute,
    payload: event.payload,
  })),
);

// Semifinal SCHEDULED (Argentina x Croácia) — placar zerado, sem eventos.
matchRows.push({
  id: SCHEDULED_MATCH_ID,
  competitionId: COMPETITION.id,
  status: 'SCHEDULED',
  minute: 0,
  startedAt: null,
  finishedAt: null,
  updatedAt: new Date(),
  sequence: 0,
  teamAId: 'arg',
  teamBId: 'fra',
  teamAGoals: 0,
  teamBGoals: 0,
});

const allMatchIds = matchRows.map((m) => m.id);
const allTeamIds = TEAMS.map((t) => t.id);

async function main(): Promise<void> {
  await prisma.$transaction([
    // Limpa dados anteriores do seed (idempotente).
    prisma.matchEvent.deleteMany({ where: { matchId: { in: allMatchIds } } }),
    prisma.goal.deleteMany({ where: { matchId: { in: allMatchIds } } }),
    prisma.match.deleteMany({ where: { competitionId: COMPETITION.id } }),
    prisma.player.deleteMany({ where: { teamId: { in: allTeamIds } } }),
    prisma.team.deleteMany({ where: { id: { in: allTeamIds } } }),
    prisma.competition.deleteMany({ where: { id: COMPETITION.id } }),

    // Recria tudo.
    prisma.competition.create({ data: COMPETITION }),
    prisma.team.createMany({ data: TEAMS }),
    prisma.player.createMany({ data: players }),
    prisma.match.createMany({ data: matchRows }),
    prisma.goal.createMany({ data: goalRows }),
    prisma.matchEvent.createMany({ data: eventRows }),
  ]);

  const finished = matchRows.filter((m) => m.status === 'FINISHED').length;
  console.log(
    `Seed concluído: ${COMPETITION.name} — ${TEAMS.length} seleções, ${players.length} jogadores, ` +
      `${matchRows.length} partidas (${finished} FINISHED + ${SCHEDULED_MATCH_ID} SCHEDULED), ` +
      `${goalRows.length} gols, ${eventRows.length} eventos.`,
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
