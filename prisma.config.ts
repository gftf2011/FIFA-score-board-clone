import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

/**
 * Configuração do Prisma (substitui o bloco `prisma` do package.json, que será
 * removido no Prisma 7). O comando de seed é executado por `prisma db seed`.
 *
 * Com um arquivo de config, o Prisma deixa de auto-carregar o `.env`, então o
 * carregamos aqui (quando existir) para preservar a conveniência local. No
 * Docker/CI as variáveis já vêm do ambiente.
 */
if (existsSync('.env') && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
