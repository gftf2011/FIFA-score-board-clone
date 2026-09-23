import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import type { MatchEvent } from '../../domain/aggregates/match.aggregate';
import type { MatchEventPublisher } from '../../domain/publishers/match-event.publisher';

/** Configuração do publisher SNS. */
export interface SnsMatchEventPublisherOptions {
  /** ARN do tópico SNS de destino. */
  readonly topicArn: string;
}

/**
 * Implementação do {@link MatchEventPublisher} que despacha os eventos da
 * partida para um tópico AWS SNS. O corpo da mensagem é o evento serializado em
 * JSON; `MessageAttributes` (`type`, `sequence`) permitem que as subscriptions
 * apliquem filter policies por tipo de evento.
 */
export class SnsMatchEventPublisher implements MatchEventPublisher {
  constructor(
    private readonly sns: SNSClient,
    private readonly options: SnsMatchEventPublisherOptions,
  ) {}

  async publish(event: MatchEvent): Promise<void> {
    await this.sns.send(
      new PublishCommand({
        TopicArn: this.options.topicArn,
        Subject: `MatchEvent:${event.type}`,
        Message: JSON.stringify(event),
        MessageAttributes: {
          type: { DataType: 'String', StringValue: event.type },
          matchId: { DataType: 'String', StringValue: event.matchId },
          competitionId: { DataType: 'String', StringValue: event.competitionId },
          sequence: { DataType: 'Number', StringValue: String(event.sequence) },
        },
      }),
    );
  }
}
