# FIFA-score-board-clone

API em Node.js construída com [Fastify](https://fastify.dev/), TypeScript e **Clean Architecture**, para acompanhar partidas de futebol ao vivo. O estado é persistido no PostgreSQL (fonte da verdade) e projetado no Redis (read model + pub/sub) por um pipeline orientado a eventos.

## Requisitos

- Node.js >= 20
- Docker + Docker Compose (para subir Postgres, Redis e o emulador AWS)

## Arquitetura orientada a eventos

```
HTTP → API (Fastify)
         └─ grava a partida + o evento no outbox   (uma única transação Postgres)
Relay do outbox  → lê outbox_messages → publica no SNS
SNS → SQS → Worker/Lambda  → projeta no Redis (read model) + publica no pub/sub
```

- **Transactional outbox**: a API não publica direto no broker. O evento é gravado na tabela `outbox_messages` na **mesma transação** que persiste a partida (sem dual-write). O **relay** (`src/main/outbox-relay.ts`) lê as mensagens pendentes e publica no SNS — entrega _at-least-once_, com consumidores idempotentes.
- **Projeção (read model)**: o worker consome a fila e materializa a partida no Redis (HASH de status, ZSET da linha do tempo, SETs de placar), além de publicar no canal pub/sub para assinantes.

## Scripts

| Comando                | Descrição                                                   |
| ---------------------- | ----------------------------------------------------------- |
| `npm run dev`          | Sobe a API em modo watch (via `tsx`)                        |
| `npm run worker:dev`   | Worker que consome a fila SQS e projeta no Redis (watch)    |
| `npm run relay:dev`    | Relay do outbox: publica os eventos pendentes no SNS (watch)|
| `npm run seed`         | Popula o banco (Copa do Mundo FIFA 2022 — 64 partidas)      |
| `npm run build`        | Compila o TypeScript para `dist/`                           |
| `npm start`            | Executa o build gerado (`dist/main/server.js`)              |
| `npm run typecheck`    | Checagem de tipos sem emitir arquivos                       |
| `npm run lint`         | Roda o ESLint (`lint:fix` corrige o automático)             |
| `npm run format`       | Formata com Prettier (`format:check` só verifica)           |
| `npm run up`           | Sobe toda a stack no Docker (build + detach)                |
| `npm run up:seed`      | Sobe a stack e roda o seed                                  |
| `npm run seed:docker`  | Roda o seed dentro do Docker                                |
| `npm run simulate`     | Dispara uma partida ao vivo pela API (`scripts/…`)          |
| `npm run logs`         | Segue os logs do serviço `app`                              |
| `npm run down`         | Derruba a stack (`down:clean` também remove os volumes)     |

## Variáveis de ambiente

| Variável            | Padrão                        | Descrição                                  |
| ------------------- | ----------------------------- | ------------------------------------------ |
| `NODE_ENV`          | `development`                 | Ambiente de execução                       |
| `HOST`              | `0.0.0.0`                     | Host de bind da API                        |
| `PORT`              | `3000`                        | Porta HTTP                                 |
| `LOG_LEVEL`         | `info`                        | Nível de log do logger                     |
| `DATABASE_URL`      | —                             | Conexão PostgreSQL (Prisma)                |
| `REDIS_URL`         | `redis://localhost:6379`      | Conexão Redis (projeção + pub/sub)         |
| `SNS_TOPIC_ARN`     | —                             | Tópico SNS de destino (relay do outbox)    |
| `SQS_QUEUE_NAME`    | `match-events-notify`         | Fila SQS consumida pelo worker             |
| `AWS_ENDPOINT_URL`  | —                             | Endpoint AWS (emulador local, ex.: floci)  |
| `AWS_REGION`        | —                             | Região AWS                                 |

## Endpoints

| Método + rota                  | Descrição                                   |
| ------------------------------ | ------------------------------------------- |
| `POST /matches/:id/start`      | Inicia uma partida agendada (204)           |
| `POST /matches/:id/events`     | Registra um evento (gol, falta, intervalo…) |
| `POST /matches/:id/finish`     | Encerra uma partida em andamento (204)      |
| `GET  /matches/:id/stream`     | Stream SSE dos eventos da partida em tempo real |

## Estrutura (Clean Architecture)

Organizada por _feature module_ (`match`) mais um `shared`. As dependências
apontam sempre de fora para dentro: as camadas externas conhecem as internas,
nunca o contrário.

```
src/
├── match/                    # Feature module da partida
│   ├── domain/               #   Regras de negócio puras
│   │   ├── aggregates/       #     Agregado Match (estado + invariantes)
│   │   ├── entities/         #     Competition, Team, Player, Goal
│   │   ├── publishers/       #     Port de publicação de eventos
│   │   └── repositories/     #     Ports (match, projeção, outbox)
│   ├── application/          #   Casos de uso e consumidores
│   │   ├── use-cases/        #     Start/Finish/RegisterEvent/RelayOutbox
│   │   └── consumers/        #     Projeção do evento no read model
│   ├── infrastructure/       #   Implementações concretas dos ports
│   │   ├── repositories/     #     Prisma (raw queries) e Redis
│   │   └── publishers/       #     SNS, Redis pub/sub, Outbox
│   ├── presentation/         #   Adaptadores de entrega
│   │   ├── http/             #     Controller Fastify
│   │   └── lambda/           #     Handler SQS→projeção
│   └── main/                 #   Composition roots (api, lambda, relay)
├── shared/                   # Blocos reutilizáveis (UnitOfWork, clients, erros)
└── main/                     # Entrypoints: server, sqs-worker, outbox-relay
```

- **domain**: não importa nada de outras camadas.
- **application**: depende apenas de `domain`; define _ports_ implementados fora.
- **infrastructure**: implementa os _ports_ (Prisma via raw queries, Redis, AWS).
- **presentation**: adapta o mundo externo (HTTP/SQS) para os casos de uso.
- **main**: injeta as dependências e inicia cada processo.

## Desenvolvimento

```bash
npm install
npm run up:seed        # sobe a stack (Postgres, Redis, AWS emulado) e popula os dados
npm run simulate       # dirige uma partida ao vivo pela API
```

Para rodar os processos localmente (fora do Docker), suba a infraestrutura com
`npm run up` e então `npm run dev`, `npm run worker:dev` e `npm run relay:dev`
em terminais separados.
