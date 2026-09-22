import type { HttpClient } from '@shared/api/HttpClient';
import type { Section } from '../models/Section';

/**
 * Acceso remoto al contenido de las secciones. Solo realiza la petición.
 */
export class SectionsApi {
  private static readonly ENDPOINT = '/data/sections.json';

  /**
   * Crea el acceso remoto.
   *
   * @param http Cliente HTTP compartido.
   */
  public constructor(private readonly http: HttpClient) {}

  /**
   * Obtiene las secciones en el orden en que se muestran.
   *
   * @returns Secciones tal como las entrega el backend.
   */
  public getSections(): Promise<Section[]> {
    return this.http.get<Section[]>(SectionsApi.ENDPOINT);
  }
}
