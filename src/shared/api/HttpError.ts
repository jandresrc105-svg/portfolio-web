/**
 * Error de una petición HTTP con respuesta no exitosa.
 */
export class HttpError extends Error {
  /**
   * Crea el error a partir de la respuesta fallida.
   *
   * @param status Código de estado HTTP.
   * @param url URL solicitada.
   */
  public constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`La petición a ${url} falló con estado ${String(status)}`);
    this.name = 'HttpError';
  }
}
