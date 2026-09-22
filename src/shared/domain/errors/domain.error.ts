/**
 * Erro base da camada de domínio. Representa a violação de uma regra de
 * negócio / invariante. Distingue-se de {@link ApplicationError} (camada de
 * aplicação) para permitir tratamento diferenciado nas camadas externas.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
