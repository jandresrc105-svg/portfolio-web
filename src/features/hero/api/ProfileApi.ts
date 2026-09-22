import type { HttpClient } from '@shared/api/HttpClient';
import type { Profile } from '../models/Profile';

/**
 * Acceso remoto al perfil. Solo realiza la petición; no contiene lógica de negocio.
 */
export class ProfileApi {
  private static readonly ENDPOINT = '/data/profile.json';

  /**
   * Crea el acceso remoto al perfil.
   *
   * @param http Cliente HTTP compartido.
   */
  public constructor(private readonly http: HttpClient) {}

  /**
   * Obtiene el perfil profesional.
   *
   * @returns Perfil tal como lo entrega el backend.
   */
  public getProfile(): Promise<Profile> {
    return this.http.get<Profile>(ProfileApi.ENDPOINT);
  }
}
