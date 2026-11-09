export class ErrorDominio extends Error {
  constructor(
    public readonly codigo: string,
    message: string
  ) {
    super(message);
    this.name = 'ErrorDominio';
  }
}
