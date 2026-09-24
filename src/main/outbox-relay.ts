import { makeRelayOutboxMessages } from '../match/main/relay/factories/relay-outbox-messages.factory';
import { prisma } from '../shared/infrastructure/prisma/prisma-client';

/**
 * Entrypoint do relay do transactional outbox: faz polling da tabela
 * `outbox_messages` e delega cada lote ao {@link RelayOutboxMessagesUseCase} — o
 * mesmo caso de uso, testável e desacoplado, que orquestra leitura/publicação.
 *
 * A publicação é at-least-once (marca-se `published_at` só após o SNS aceitar);
 * os consumidores a jusante já são idempotentes (dedup por `eventId`).
 */
const BATCH_SIZE = 50;
const IDLE_DELAY_MS = 300;

const relay = makeRelayOutboxMessages();

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  let running = true;
  const stop = (): void => {
    running = false;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log('Relay do outbox iniciado (polling de outbox_messages)');

  while (running) {
    const processed = await relay.execute({ batchSize: BATCH_SIZE });
    // Lote incompleto → aguarda antes de nova sondagem; lote cheio → segue
    // imediatamente para escoar o backlog.
    if (processed < BATCH_SIZE) await delay(IDLE_DELAY_MS);
  }

  await prisma.$disconnect();
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error('Relay do outbox encerrado com erro', error);
  process.exit(1);
});
