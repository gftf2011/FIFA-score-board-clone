import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import { makeNotifyMatchEventConsumer } from '../../main/lambda/factories/notify-match-event-consumer.factory';

// Construído no cold start e reaproveitado entre invocações.
const consumer = makeNotifyMatchEventConsumer();

/**
 * Handler da Lambda disparada pela fila SQS (inscrita no tópico SNS). Cada
 * mensagem é um {@link MatchEvent} (raw message delivery); o consumidor o
 * publica no pub/sub do Redis. Usa `batchItemFailures` para reenfileirar apenas
 * as mensagens que falharam.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const matchEvent = JSON.parse(record.body) as MatchEvent;
      await consumer.handle(matchEvent);
    } catch (error) {
      console.error('Falha ao processar mensagem SQS', record.messageId, error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
