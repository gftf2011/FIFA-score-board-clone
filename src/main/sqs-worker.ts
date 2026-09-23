import {
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import type { MatchEvent } from '../match/domain/aggregates/match.aggregate';
import { makeNotifyMatchEventConsumer } from '../match/main/lambda/factories/notify-match-event-consumer.factory';
import { redis } from '../shared/infrastructure/redis/redis-client';

/**
 * Worker que faz long-polling da fila SQS (inscrita no tópico SNS) e delega
 * cada mensagem ao NotifyMatchEventConsumer — o mesmo consumidor usado pela
 * Lambda. É a forma confiável de rodar o consumo localmente (sem depender da
 * execução de Lambda dentro do emulador). Em produção, a Lambda cumpre o papel.
 */
const consumer = makeNotifyMatchEventConsumer();
// região/endpoint (AWS_ENDPOINT_URL) vêm do ambiente. `useQueueUrlAsEndpoint`
// false evita que o SDK adote o host da QueueUrl (localhost:4566, devolvido pelo
// emulador) como endpoint das chamadas seguintes — o que, dentro do container,
// aponta para o próprio worker e quebra com ECONNREFUSED.
const sqs = new SQSClient({ useQueueUrlAsEndpoint: false });
const queueName = process.env.SQS_QUEUE_NAME ?? 'match-events-notify';

async function main(): Promise<void> {
  const { QueueUrl } = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
  if (QueueUrl === undefined) {
    throw new Error(`Fila SQS não encontrada: ${queueName}`);
  }

  let running = true;
  const stop = (): void => {
    running = false;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log(`Worker consumindo da fila ${queueName}`);

  while (running) {
    const { Messages } = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20, // long polling
      }),
    );

    for (const message of Messages ?? []) {
      if (message.Body === undefined || message.ReceiptHandle === undefined) continue;
      try {
        const event = JSON.parse(message.Body) as MatchEvent;
        await consumer.handle(event);
        // Sucesso → remove da fila. Em erro, a mensagem volta após o visibility timeout.
        await sqs.send(
          new DeleteMessageCommand({ QueueUrl, ReceiptHandle: message.ReceiptHandle }),
        );
      } catch (error) {
        console.error('Falha ao processar mensagem SQS', message.MessageId, error);
      }
    }
  }

  redis.disconnect();
  process.exit(0);
}

void main().catch((error: unknown) => {
  console.error('Worker encerrado com erro', error);
  process.exit(1);
});
