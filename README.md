# FIFA-score-board-clone

Node.js API built with [Fastify](https://fastify.dev/), TypeScript and **Clean Architecture**, to follow football matches live. State is persisted in PostgreSQL (source of truth) and projected into Redis (read model + pub/sub) by an event-driven pipeline.

## Requirements

- Node.js >= 20
- Docker + Docker Compose (to run Postgres, Redis and the AWS emulator)

## Event-driven architecture

```
HTTP →  Ingestion (server.ts, :3000)
          └─ writes the match + the event to the outbox   (a single Postgres transaction)
Outbox relay  → reads outbox_messages → publishes to SNS
SNS → SQS → Worker/Lambda  → projects into Redis (read model) + publishes to pub/sub
Redis pub/sub → Stream (stream-server.ts, :3001) → SSE to the clients
```

- **Two separate servers** (scale independently): **ingestion** (`src/main/server.ts`, writes → Postgres+outbox) and **stream** (`src/main/stream-server.ts`, live SSE → Redis). One processes commands; the other holds the SSE connections.
- **Transactional outbox**: ingestion does not publish straight to the broker. The event is written to the `outbox_messages` table in the **same transaction** that persists the match (no dual-write). The **relay** (`src/main/outbox-relay.ts`) reads the pending ones and publishes to SNS — _at-least-once_, with idempotent consumers.
- **Projection (read model)**: the worker consumes the queue and materializes the match in Redis (the event timeline), also publishing to the pub/sub channel. The stream server keeps per-match state in memory and sends the snapshot + live events.

## Scripts

| Command                | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Runs the ingestion server in watch mode (`:3000`)           |
| `npm run dev:stream`   | Runs the stream server in watch mode (`:3001`)              |
| `npm run worker:dev`   | Worker that consumes the SQS queue and projects into Redis (watch) |
| `npm run relay:dev`    | Outbox relay: publishes pending events to SNS (watch)       |
| `npm run seed`         | Seeds the database (FIFA World Cup 2022 — 64 matches)       |
| `npm run build`        | Compiles TypeScript to `dist/`                              |
| `npm start`            | Runs the generated build (`dist/main/server.js`)           |
| `npm run typecheck`    | Type-checks without emitting files                          |
| `npm run lint`         | Runs ESLint (`lint:fix` auto-fixes)                         |
| `npm run format`       | Formats with Prettier (`format:check` only checks)          |
| `npm run up`           | Brings the whole stack up in Docker (build + detach)        |
| `npm run up:seed`      | Brings the stack up and runs the seed                       |
| `npm run seed:docker`  | Runs the seed inside Docker                                 |
| `npm run simulate`     | Drives a live match through the API (`scripts/…`)           |
| `npm run mcp`          | Starts the MCP server (stdio) for match status              |
| `npm run mcp:call`     | Invokes an MCP server tool from the terminal (`scripts/…`)  |
| `npm run logs`         | Follows the `app` service logs                              |
| `npm run down`         | Tears the stack down (`down:clean` also removes volumes)    |

## Environment variables

| Variable            | Default                       | Description                                |
| ------------------- | ----------------------------- | ------------------------------------------ |
| `NODE_ENV`          | `development`                 | Runtime environment                        |
| `HOST`              | `0.0.0.0`                     | Bind host for the servers                  |
| `PORT`              | `3000`                        | Ingestion server port                      |
| `STREAM_PORT`       | `3001`                        | Stream server port                         |
| `LOG_LEVEL`         | `info`                        | Logger level                               |
| `DATABASE_URL`      | —                             | PostgreSQL connection (Prisma)             |
| `REDIS_URL`         | `redis://localhost:6379`      | Redis connection (projection + pub/sub)    |
| `SNS_TOPIC_ARN`     | —                             | Target SNS topic (outbox relay)            |
| `SQS_QUEUE_NAME`    | `match-events-notify`         | SQS queue consumed by the worker           |
| `AWS_ENDPOINT_URL`  | —                             | AWS endpoint (local emulator, e.g. floci)  |
| `AWS_REGION`        | —                             | AWS region                                 |

## Endpoints

| Method + route                 | Server              | Description                                 |
| ------------------------------ | ------------------- | ------------------------------------------- |
| `POST /matches/:id/start`      | ingestion (`:3000`) | Starts a scheduled match (204)              |
| `POST /matches/:id/events`     | ingestion (`:3000`) | Registers an event (goal, foul, half-time…) |
| `POST /matches/:id/finish`     | ingestion (`:3000`) | Finishes a match in progress (204)          |
| `GET  /matches/:id/stream`     | stream (`:3001`)    | SSE stream of the match events in real time |

## MCP server (match status)

An **MCP server** ([MCP](https://modelcontextprotocol.io/) protocol, stdio transport) that exposes match status as _tools_ for an agent (e.g. Claude Code) to query. It is **read-only**: it reads the read model from Postgres (`PrismaMatchStatusQuery`) and never changes any match state.

**Prerequisite:** Postgres up with data (`npm run up:seed`). The server uses `DATABASE_URL` (default: the local docker-compose database).

### Tools

| Tool               | Arguments                                     | Description                                            |
| ------------------ | --------------------------------------------- | ------------------------------------------------------ |
| `list_matches`     | `status?`, `competitionId?`                   | Lists matches (most recent first) with score/minute    |
| `get_match_status` | `matchId` (required)                          | Current status of one match (score, minute, teams)     |

Each match also returns a ready-made `scoreline`, e.g. `"ARG 2 x 1 FRA"`.

### How to use

**In Claude Code / MCP clients.** The `.mcp.json` file at the root already registers the `fifa-score-board` server. Restart `claude` in this folder (approve the project server), confirm with `claude mcp list`, and ask in natural language — the client calls the tools on its own:

> _"Which matches are in progress?"_ · _"What's the status of match wc-2022-semifinal?"_

The client runs `npm run mcp` under the hood; you do **not** start the server yourself.

**From the terminal (one call at a time).** The script starts the server internally, makes the call, and exits — it does **not** need `npm run mcp` running separately:

```bash
npm run mcp:call list_matches
npm run mcp:call list_matches '{"status":"IN_PROGRESS"}'
npm run mcp:call list_matches '{"competitionId":"wc-2022"}'
npm run mcp:call get_match_status '{"matchId":"wc-2022-semifinal"}'
```

Syntax: `./scripts/mcp-call.sh <tool> [json-arguments]` (without arguments, it uses `{}`).

**With the MCP Inspector (web UI).** To explore the tools visually:

```bash
npx @modelcontextprotocol/inspector npm run mcp
```

## Structure (Clean Architecture)

Organized by _feature module_ (`match`) plus a `shared`. Dependencies always
point from the outside in: outer layers know the inner ones, never the other way
around.

```
src/
├── match/                    # Match feature module
│   ├── domain/               #   Pure business rules
│   │   ├── aggregates/       #     Match aggregate (state + invariants)
│   │   ├── entities/         #     Competition, Team, Player, Goal
│   │   ├── publishers/       #     Event publishing port
│   │   └── repositories/     #     Ports (match, projection, outbox)
│   ├── application/          #   Use cases and consumers
│   │   ├── use-cases/        #     Start/Finish/RegisterEvent/RelayOutbox
│   │   └── consumers/        #     Event projection into the read model
│   ├── infrastructure/       #   Concrete implementations of the ports
│   │   ├── repositories/     #     Prisma (raw queries) and Redis
│   │   ├── queries/          #     Read models (e.g. match status for the MCP)
│   │   └── publishers/       #     SNS, Redis pub/sub, Outbox
│   ├── presentation/         #   Delivery adapters
│   │   ├── http/             #     Fastify controller
│   │   └── lambda/           #     SQS→projection handler
│   └── main/                 #   Composition roots (api, lambda, relay)
├── shared/                   # Reusable building blocks (UnitOfWork, clients, errors)
└── main/                     # Entrypoints: server (ingestion), stream-server, sqs-worker, outbox-relay, mcp-server
```

- **domain**: imports nothing from other layers.
- **application**: depends only on `domain`; defines _ports_ implemented outside.
- **infrastructure**: implements the _ports_ (Prisma via raw queries, Redis, AWS).
- **presentation**: adapts the outside world (HTTP/SQS) to the use cases.
- **main**: wires the dependencies and starts each process.

## Development

```bash
npm install
npm run up:seed        # brings the stack up (Postgres, Redis, emulated AWS) and seeds the data
npm run simulate       # drives a live match through the API
```

To run the processes locally (outside Docker), bring the infrastructure up with
`npm run up` and then run `npm run dev`, `npm run dev:stream`, `npm run worker:dev` and `npm run relay:dev`
in separate terminals.
