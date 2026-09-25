/**
 * Teste de carga do stream SSE (`GET /matches/:id/stream`, stream-server :3001).
 *
 * Abre N conexões SSE concorrentes para a MESMA partida e mede o caminho de
 * leitura: escalabilidade de conexão, latência até o `snapshot`, throughput dos
 * eventos ao vivo, o _spread_ do fan-out (diferença entre o primeiro e o último
 * cliente a receber o mesmo evento) e a capacidade (HTTP 429 ao estourar o teto
 * de clientes por partida).
 *
 * Dois modos:
 *   - padrão (só leitura): apenas conecta os clientes; mede conexão + snapshot.
 *   - `--drive`: AUTOCONTIDO. Cria uma partida descartável (namespace próprio
 *     `loadtest-…`, sem tocar no seed), dispara os próprios eventos pela API de
 *     ingestão para exercitar o fan-out e, ao final — inclusive em erro ou
 *     Ctrl+C —, APAGA tudo o que criou no Postgres e no Redis. Não depende do
 *     `npm run simulate`.
 *
 * Uso:
 *   npm run loadtest:stream -- [opções]
 *   npm run loadtest:stream -- --drive --clients 500 --duration 30
 *   tsx scripts/load-test-stream.ts --clients 200 --duration 20
 *
 * Opções (flag ou variável de ambiente):
 *   --clients   N   CLIENTS    Conexões SSE simultâneas            (padrão: 200)
 *   --duration  S   DURATION   Duração do teste em segundos        (padrão: 20)
 *   --ramp      S   RAMP       Janela de rampa das conexões (s)    (padrão: 2)
 *   --drive         DRIVE=1    Dispara e depois apaga os próprios eventos
 *   --eps       N   EPS        Eventos/segundo no modo --drive     (padrão: 5)
 *   --match     ID  MATCH_ID   Partida alvo (só leitura) (padrão: wc-2022-semifinal)
 *   --url       U   STREAM_URL Base do stream-server  (padrão: http://localhost:3001)
 *   --ingest    U   INGEST_URL Base da ingestão (--drive)  (padrão: http://localhost:3000)
 */
import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

interface Options {
  clients: number;
  durationMs: number;
  rampMs: number;
  matchId: string;
  baseUrl: string;
  ingestUrl: string;
  drive: boolean;
  eps: number;
}

/** Lê as opções da linha de comando, caindo para env e depois para os padrões. */
function parseOptions(argv: string[]): Options {
  const flags = new Map<string, string>();
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg?.startsWith('--')) continue;
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) bools.add(name);
    else flags.set(name, next);
  }
  const pick = (flag: string, env: string): string | undefined =>
    flags.get(flag) ?? process.env[env];
  const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  const drive = bools.has('drive') || process.env.DRIVE === '1';

  // Em --drive a partida é sempre uma throwaway gerada (para o cleanup ser
  // seguro); em só leitura, usa a partida informada.
  const matchId = drive
    ? `loadtest-${Date.now().toString(36)}`
    : (pick('match', 'MATCH_ID') ?? 'wc-2022-semifinal');

  return {
    clients: Math.floor(num(pick('clients', 'CLIENTS'), 200)),
    durationMs: num(pick('duration', 'DURATION'), 20) * 1000,
    rampMs: num(pick('ramp', 'RAMP'), 2) * 1000,
    matchId,
    baseUrl: pick('url', 'STREAM_URL') ?? 'http://localhost:3001',
    ingestUrl: pick('ingest', 'INGEST_URL') ?? 'http://localhost:3000',
    drive,
    eps: num(pick('eps', 'EPS'), 5),
  };
}

/** Métricas acumuladas por um único cliente SSE. */
interface ClientMetrics {
  connectMs: number | null;
  snapshotMs: number | null;
  events: number;
  heartbeats: number;
  bytes: number;
  status: number | null;
  error: string | null;
}

/** Recepção de um mesmo evento entre clientes — base do _spread_ de fan-out. */
interface FanoutRecord {
  first: number;
  last: number;
  count: number;
}

/** Estado global agregado da execução. */
interface Aggregate {
  readonly startedAt: number;
  readonly metrics: ClientMetrics[];
  /** eventKey (id ou type+sequence) → tempos de recepção pelos clientes. */
  readonly fanout: Map<string, FanoutRecord>;
  connectedNow: number;
  peakConnected: number;
}

/** Percentil (interpolação linear) de uma amostra; `NaN` se vazia. */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const weight = rank - low;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * weight;
}

/** Formata milissegundos legível. */
function ms(value: number): string {
  return Number.isNaN(value) ? '—' : `${value.toFixed(1)}ms`;
}

/** Escolhe o transporte (http/https) a partir da URL. */
function transportFor(url: URL): typeof http | typeof https {
  return url.protocol === 'https:' ? https : http;
}

/**
 * Abre uma conexão SSE e alimenta as métricas do cliente e o mapa de fan-out.
 * Devolve o request para permitir o encerramento no fim do teste.
 */
function openClient(opts: Options, agg: Aggregate): http.ClientRequest {
  const url = new URL(`/matches/${opts.matchId}/stream`, opts.baseUrl);
  const metric: ClientMetrics = {
    connectMs: null,
    snapshotMs: null,
    events: 0,
    heartbeats: 0,
    bytes: 0,
    status: null,
    error: null,
  };
  agg.metrics.push(metric);
  const startedAt = performance.now();

  const request = transportFor(url).request(
    url,
    { method: 'GET', headers: { Accept: 'text/event-stream' } },
    (response) => {
      metric.status = response.statusCode ?? null;

      if (response.statusCode !== 200) {
        // Ex.: 429 (capacidade) — consome o corpo e conta como não conectado.
        response.resume();
        response.on('data', (chunk: Buffer) => (metric.bytes += chunk.length));
        return;
      }

      metric.connectMs = performance.now() - startedAt;
      agg.connectedNow += 1;
      agg.peakConnected = Math.max(agg.peakConnected, agg.connectedNow);

      let buffer = '';
      response.setEncoding('utf8');

      const handleFrame = (frame: string): void => {
        let currentEvent = 'message';
        let data = '';
        for (const rawLine of frame.split('\n')) {
          const line = rawLine.trimEnd();
          if (line.startsWith(':')) {
            metric.heartbeats += 1; // comentário SSE (ex.: ": ping")
          } else if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            data += line.slice(5).trim();
          }
        }

        if (currentEvent === 'snapshot') {
          if (metric.snapshotMs === null) metric.snapshotMs = performance.now() - startedAt;
          return;
        }
        if (data === '') return; // frame só de heartbeat/comentário

        metric.events += 1;
        recordFanout(agg, currentEvent, data);
      };

      response.on('data', (chunk: string) => {
        metric.bytes += Buffer.byteLength(chunk);
        buffer += chunk;
        // Frames SSE são separados por linha em branco (\n\n).
        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          handleFrame(buffer.slice(0, sep));
          buffer = buffer.slice(sep + 2);
          sep = buffer.indexOf('\n\n');
        }
      });

      response.on('end', () => {
        agg.connectedNow -= 1;
      });
    },
  );

  request.on('error', (err) => {
    if (metric.error === null) metric.error = err.message;
    if (metric.connectMs !== null) agg.connectedNow -= 1;
  });
  request.end();
  return request;
}

/** Registra a recepção de um evento para o cálculo do _spread_ de fan-out. */
function recordFanout(agg: Aggregate, eventType: string, data: string): void {
  let key: string;
  try {
    const parsed = JSON.parse(data) as { id?: string; sequence?: number };
    key = parsed.id ?? `${eventType}:${parsed.sequence ?? 'na'}`;
  } catch {
    return; // payload inesperado: fora da medição de fan-out
  }

  const now = performance.now();
  const existing = agg.fanout.get(key);
  if (existing === undefined) {
    agg.fanout.set(key, { first: now, last: now, count: 1 });
  } else {
    existing.last = now;
    existing.count += 1;
  }
}

/** POST JSON simples na ingestão; resolve com o status HTTP. */
function post(baseUrl: string, path: string, body?: unknown): Promise<number> {
  const url = new URL(path, baseUrl);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  // Só declara content-type/length quando há corpo: com `application/json` e
  // corpo vazio o Fastify responde 400 (não pode parsear body vazio).
  const headers = payload
    ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
    : {};
  return new Promise((resolve, reject) => {
    const req = transportFor(url).request(
      url,
      { method: 'POST', headers },
      (res) => {
        res.resume(); // descarta o corpo
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Recursos criados pelo driver, para o cleanup saber o que apagar. */
interface DriveContext {
  readonly matchId: string;
  readonly competitionId: string;
  readonly teamAId: string;
  readonly teamBId: string;
  // Singletons carregados dinamicamente só no modo --drive.
  readonly prisma: PrismaClient;
  readonly redis: Redis;
}

/**
 * Cria uma partida descartável (competição + 2 times + match SCHEDULED) direto
 * no Postgres, no namespace `loadtest-…`, para o driver poder iniciá-la e
 * disparar eventos sem tocar nos dados semeados.
 */
async function setupDriveMatch(opts: Options): Promise<DriveContext> {
  // Defaults do docker-compose local — para o --drive funcionar sem exportar
  // env na mão. Só preenche o que não veio do ambiente (env sempre vence).
  process.env.DATABASE_URL ??= 'postgresql://fifa:fifa@localhost:5432/fifa?schema=public';
  process.env.REDIS_URL ??= 'redis://localhost:6379';

  // Import dinâmico DEPOIS de garantir as envs: os singletons leem DATABASE_URL/
  // REDIS_URL ao serem instanciados.
  const { prisma } = await import('../src/shared/infrastructure/prisma/prisma-client');
  const { redis } = await import('../src/shared/infrastructure/redis/redis-client');

  const suffix = opts.matchId.replace(/^loadtest-/, '');
  const ctx: DriveContext = {
    matchId: opts.matchId,
    competitionId: `loadtest-comp-${suffix}`,
    teamAId: `loadtest-team-a-${suffix}`,
    teamBId: `loadtest-team-b-${suffix}`,
    prisma,
    redis,
  };

  await prisma.competition.create({
    data: { id: ctx.competitionId, name: 'Load Test Cup', type: 'LEAGUE' },
  });
  await prisma.team.createMany({
    data: [
      { id: ctx.teamAId, name: 'Load Test A', shortName: 'LTA' },
      { id: ctx.teamBId, name: 'Load Test B', shortName: 'LTB' },
    ],
  });
  await prisma.match.create({
    data: {
      id: ctx.matchId,
      competitionId: ctx.competitionId,
      status: 'SCHEDULED',
      minute: 0,
      updatedAt: new Date(),
      sequence: 0,
      teamAId: ctx.teamAId,
      teamBId: ctx.teamBId,
      teamAGoals: 0,
      teamBGoals: 0,
    },
  });

  return ctx;
}

/**
 * Dirige a partida throwaway: inicia, dispara escanteios a `eps` eventos/s
 * durante a janela do teste e encerra. Os escanteios são eventos neutros
 * (não exigem chute prévio nem validação de time), ideais para gerar fan-out.
 * Resolve quando o `finish` é enviado ou quando `abort()` sinaliza o fim.
 */
async function driveMatch(opts: Options, ctx: DriveContext, abort: AbortSignal): Promise<void> {
  await post(opts.ingestUrl, `/matches/${ctx.matchId}/start`);

  const intervalMs = Math.max(1, Math.floor(1000 / opts.eps));
  let n = 0;
  while (!abort.aborted) {
    n += 1;
    await post(opts.ingestUrl, `/matches/${ctx.matchId}/events`, {
      type: 'CORNER_KICK',
      player: {
        id: `${ctx.teamAId}-p${(n % 11) + 1}`,
        name: `Player ${n}`,
        teamId: ctx.teamAId,
        shirtNumber: (n % 11) + 1,
        position: 'MIDFIELDER',
      },
    });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  await post(opts.ingestUrl, `/matches/${ctx.matchId}/finish`);
}

/** Apaga TUDO o que o driver criou (Postgres + Redis). Idempotente e à prova de erro. */
async function cleanupDriveMatch(ctx: DriveContext): Promise<void> {
  const { prisma, redis, matchId } = ctx;
  try {
    await prisma.matchEvent.deleteMany({ where: { matchId } });
    await prisma.goal.deleteMany({ where: { matchId } });
    await prisma.outboxMessage.deleteMany({ where: { matchId } });
    await prisma.match.deleteMany({ where: { id: matchId } });
    await prisma.team.deleteMany({ where: { id: { in: [ctx.teamAId, ctx.teamBId] } } });
    await prisma.competition.deleteMany({ where: { id: ctx.competitionId } });
    await redis.del(`match:${matchId}:events`);
    console.error(`  cleanup: dados da partida ${matchId} apagados (Postgres + Redis).`);
  } catch (err) {
    console.error(`  cleanup FALHOU para ${matchId}:`, (err as Error).message);
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

/** Imprime o relatório final. */
function report(opts: Options, agg: Aggregate): void {
  const wallSec = (performance.now() - agg.startedAt) / 1000;
  const connected = agg.metrics.filter((m) => m.connectMs !== null);
  const snapshots = agg.metrics.filter((m) => m.snapshotMs !== null);

  const byStatus = new Map<string, number>();
  for (const m of agg.metrics) {
    const label = m.error ? `err:${m.error}` : String(m.status ?? 'no-response');
    byStatus.set(label, (byStatus.get(label) ?? 0) + 1);
  }

  const connectLat = connected.map((m) => m.connectMs!);
  const snapLat = snapshots.map((m) => m.snapshotMs!);
  const totalEvents = agg.metrics.reduce((sum, m) => sum + m.events, 0);
  const totalHeartbeats = agg.metrics.reduce((sum, m) => sum + m.heartbeats, 0);
  const totalBytes = agg.metrics.reduce((sum, m) => sum + m.bytes, 0);
  const spreads = [...agg.fanout.values()].map((r) => r.last - r.first);

  const line = '─'.repeat(52);
  const out: string[] = [];
  out.push(line);
  out.push('  TESTE DE CARGA — STREAM SSE');
  out.push(line);
  out.push(`  Alvo            ${opts.baseUrl}/matches/${opts.matchId}/stream`);
  out.push(`  Modo            ${opts.drive ? `--drive (${opts.eps} eventos/s, autolimpa)` : 'só leitura'}`);
  out.push(`  Clientes        ${opts.clients} (rampa ${opts.rampMs / 1000}s)`);
  out.push(`  Duração real    ${wallSec.toFixed(1)}s`);
  out.push('');
  out.push('  CONEXÃO');
  out.push(`    conectados    ${connected.length}/${opts.clients}`);
  out.push(`    pico simult.  ${agg.peakConnected}`);
  for (const [label, count] of byStatus) out.push(`    status ${label.padEnd(6)} ${count}`);
  out.push('');
  out.push('  LATÊNCIA DE CONEXÃO (até os headers 200)');
  out.push(`    p50 ${ms(percentile(connectLat, 50))}  p90 ${ms(percentile(connectLat, 90))}  p99 ${ms(percentile(connectLat, 99))}  max ${ms(Math.max(0, ...connectLat))}`);
  out.push('  LATÊNCIA DO SNAPSHOT (até o 1º frame de estado)');
  out.push(`    recebidos     ${snapshots.length}/${connected.length}`);
  out.push(`    p50 ${ms(percentile(snapLat, 50))}  p90 ${ms(percentile(snapLat, 90))}  p99 ${ms(percentile(snapLat, 99))}  max ${ms(Math.max(0, ...snapLat))}`);
  out.push('');
  out.push('  EVENTOS AO VIVO');
  out.push(`    total recebido ${totalEvents} (${(totalEvents / wallSec).toFixed(1)}/s no agregado)`);
  out.push(`    eventos únicos ${agg.fanout.size}`);
  out.push(`    heartbeats     ${totalHeartbeats}`);
  if (spreads.length > 0) {
    out.push('  FAN-OUT (spread entre o 1º e o último cliente por evento)');
    out.push(`    p50 ${ms(percentile(spreads, 50))}  p90 ${ms(percentile(spreads, 90))}  p99 ${ms(percentile(spreads, 99))}  max ${ms(Math.max(...spreads))}`);
    const fullFanout = [...agg.fanout.values()].filter((r) => r.count >= connected.length).length;
    out.push(`    entregas completas ${fullFanout}/${agg.fanout.size} (recebido por todos os conectados)`);
  } else if (!opts.drive) {
    out.push('  FAN-OUT  sem eventos ao vivo — use `--drive` para o teste gerar os próprios eventos');
  }
  out.push('');
  out.push(`  Tráfego         ${(totalBytes / 1024 / 1024).toFixed(2)} MiB recebidos`);
  out.push(line);
  console.log(out.join('\n'));
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  const agg: Aggregate = {
    startedAt: performance.now(),
    metrics: [],
    fanout: new Map(),
    connectedNow: 0,
    peakConnected: 0,
  };

  // Em --drive, cria a partida descartável ANTES de conectar os clientes.
  let ctx: DriveContext | null = null;
  if (opts.drive) {
    console.log(`Modo --drive: criando partida descartável ${opts.matchId}...`);
    try {
      ctx = await setupDriveMatch(opts);
    } catch (err) {
      console.error('Falha ao preparar a partida de teste:', (err as Error).message);
      console.error('O Postgres/Redis estão no ar? (docker compose ps)');
      process.exit(1);
    }
  }

  console.log(
    `Abrindo ${opts.clients} conexões SSE em ${opts.baseUrl}/matches/${opts.matchId}/stream ` +
      `(rampa ${opts.rampMs / 1000}s, duração ${opts.durationMs / 1000}s)...`,
  );

  const requests: http.ClientRequest[] = [];
  const gap = opts.clients > 1 ? opts.rampMs / opts.clients : 0;
  for (let i = 0; i < opts.clients; i += 1) {
    requests.push(openClient(opts, agg));
    if (gap > 0) await new Promise((resolve) => setTimeout(resolve, gap));
  }

  // Dispara o driver depois que os clientes já estão conectando.
  const driveAbort = new AbortController();
  const driving =
    ctx !== null
      ? driveMatch(opts, ctx, driveAbort.signal).catch((err) =>
          console.error('  driver:', (err as Error).message),
        )
      : Promise.resolve();

  const ticker = setInterval(() => {
    process.stderr.write(
      `\r  conectados: ${agg.connectedNow}/${opts.clients} | pico: ${agg.peakConnected} | eventos únicos: ${agg.fanout.size}   `,
    );
  }, 1000);

  let finishing = false;
  const finish = async (): Promise<void> => {
    if (finishing) return;
    finishing = true;
    clearInterval(ticker);
    driveAbort.abort();
    await driving; // deixa o finish da partida ser enviado
    process.stderr.write('\n');
    for (const req of requests) req.destroy();
    report(opts, agg);
    if (ctx !== null) await cleanupDriveMatch(ctx);
    process.exit(0);
  };

  const timer = setTimeout(() => void finish(), opts.durationMs);
  process.on('SIGINT', () => {
    clearTimeout(timer);
    void finish();
  });
}

void main();
