import type { Environment } from '@shared/config/Environment';
import { HttpError } from './HttpError';

/**
 * Cliente HTTP compartido. Las clases de la capa `api` de cada feature lo usan para hacer fetch al backend.
 */
export class HttpClient {
  /**
   * Crea el cliente HTTP.
   *
   * @param environment Configuración con la URL base del backend.
   */
  public constructor(private readonly environment: Environment) {}

  /**
   * Realiza una petición GET y devuelve el cuerpo JSON.
   *
   * @param path Ruta relativa a la URL base (debe iniciar con `/`).
   * @returns Cuerpo de la respuesta.
   * @throws {HttpError} Si la respuesta no es exitosa.
   */
  public async get<T>(path: string): Promise<T> {
    const url = `${this.environment.apiUrl}${path}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new HttpError(response.status, url);
    }
    return (await response.json()) as T;
  }
}
