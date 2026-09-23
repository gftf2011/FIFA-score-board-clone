import { SNSClient } from '@aws-sdk/client-sns';

/**
 * Instância compartilhada do SNSClient. A região e as credenciais são
 * resolvidas pela cadeia padrão do SDK (variáveis de ambiente, perfil, IAM
 * role etc.). Injete-a nos publishers via construtor.
 */
export const snsClient = new SNSClient({});
