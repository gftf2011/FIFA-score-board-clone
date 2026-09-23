/** Contrato genérico de um caso de uso. */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Output>;
}
