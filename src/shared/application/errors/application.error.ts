/**
 * Erro base da camada de aplicação. Representa uma falha na orquestração de um
 * caso de uso (ex.: recurso não encontrado, operação não permitida no fluxo),
 * distinta da violação de invariantes de negócio ({@link DomainError}).
 */
export abstract class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
