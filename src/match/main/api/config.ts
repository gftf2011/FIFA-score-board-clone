/** Configuração do módulo de partida, resolvida a partir do ambiente. */
export interface MatchModuleConfig {
  /** ARN do tópico SNS para onde os eventos da partida são publicados. */
  readonly snsTopicArn: string;
}

export function loadMatchModuleConfig(): MatchModuleConfig {
  return {
    snsTopicArn: process.env.SNS_TOPIC_ARN ?? '',
  };
}
