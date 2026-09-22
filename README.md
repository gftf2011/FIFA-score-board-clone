# FIFA-score-board-clone

API em Node.js construída com [Fastify](https://fastify.dev/), TypeScript e **Clean Architecture**.

## Requisitos

- Node.js >= 20

## Scripts

| Comando                | Descrição                                      |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Sobe o servidor em modo watch (via `tsx`)      |
| `npm run build`        | Compila o TypeScript para `dist/`              |
| `npm start`            | Executa o build gerado (`dist/main/server.js`) |
| `npm run typecheck`    | Checagem de tipos sem emitir arquivos          |
| `npm run lint`         | Roda o ESLint                                  |
| `npm run lint:fix`     | Roda o ESLint corrigindo o que for automático  |
| `npm run format`       | Formata o código com Prettier                  |
| `npm run format:check` | Verifica a formatação sem alterar arquivos     |

## Variáveis de ambiente

| Variável    | Padrão                        | Descrição              |
| ----------- | ----------------------------- | ---------------------- |
| `NODE_ENV`  | `development`                 | Ambiente de execução   |
| `HOST`      | `0.0.0.0`                     | Host de bind           |
| `PORT`      | `3000`                        | Porta HTTP             |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | Nível de log do logger |

## Estrutura (Clean Architecture)

As dependências apontam sempre de fora para dentro: as camadas externas conhecem
as internas, nunca o contrário.

```
src/
├── domain/              # Camada mais interna: regras de negócio puras
│   ├── entities/        #   Entidades (ex.: Match, Team)
│   ├── value-objects/   #   Objetos de valor (ex.: Score)
│   └── errors/          #   Erros de domínio
├── application/         # Casos de uso e contratos (ports)
│   ├── use-cases/       #   Orquestram as regras de domínio
│   └── ports/           #   Interfaces (ex.: repositórios) implementadas fora
├── infrastructure/      # Detalhes de implementação (I/O)
│   └── repositories/    #   Implementações concretas dos ports
├── presentation/        # Camada de entrega
│   └── http/            #   Fastify: rotas, controllers, app
│       ├── app.ts       #   Composição da aplicação Fastify
│       └── routes/      #   Módulos de rota
└── main/                # Composition root e bootstrap
    ├── config/          #   Carregamento de configuração/env
    └── server.ts        #   Ponto de entrada da aplicação
```

- **domain**: não importa nada de outras camadas.
- **application**: depende apenas de `domain`; define _ports_ que a infraestrutura implementa.
- **infrastructure**: implementa os _ports_ da aplicação.
- **presentation**: adapta o mundo externo (HTTP) para os casos de uso.
- **main**: injeta as dependências e inicia o servidor.

## Desenvolvimento

```bash
npm install
npm run dev
```

O endpoint de health check fica disponível em `GET /health`.
