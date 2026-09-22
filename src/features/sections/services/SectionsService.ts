import type { SectionsApi } from '../api/SectionsApi';
import type { Section } from '../models/Section';
import type { SectionItem } from '../models/SectionItem';
import type { SectionLink } from '../models/SectionLink';

/**
 * Lógica de las secciones: obtención y saneamiento de enlaces (solo `https:` y `mailto:`),
 * para que un contenido remoto nunca pueda inyectar `javascript:` en la página.
 */
export class SectionsService {
  private static readonly SAFE_PROTOCOLS = new Set(['https:', 'mailto:']);

  /**
   * Crea el service.
   *
   * @param api Acceso remoto a las secciones.
   */
  public constructor(private readonly api: SectionsApi) {}

  /**
   * Obtiene las secciones listas para mostrar.
   *
   * @returns Secciones con enlaces seguros.
   */
  public async getSections(): Promise<Section[]> {
    const sections = await this.api.getSections();
    return sections.map((section) => this.sanitize(section));
  }

  /**
   * Indica si un enlace usa un protocolo permitido.
   *
   * @param link Enlace a validar.
   * @returns `true` si es seguro.
   */
  public isSafe(link: SectionLink): boolean {
    try {
      return SectionsService.SAFE_PROTOCOLS.has(new URL(link.href).protocol);
    } catch {
      return false;
    }
  }

  /**
   * Quita los enlaces inseguros de una sección y sus elementos.
   *
   * @param section Sección original.
   * @returns Sección saneada.
   */
  private sanitize(section: Section): Section {
    return {
      ...section,
      links: (section.links ?? []).filter((link) => this.isSafe(link)),
      items: (section.items ?? []).map((item) => this.sanitizeItem(item)),
    };
  }

  /**
   * Quita el enlace de un elemento si es inseguro.
   *
   * @param item Elemento original.
   * @returns Elemento saneado.
   */
  private sanitizeItem(item: SectionItem): SectionItem {
    if (!item.link || this.isSafe(item.link)) {
      return item;
    }
    const { link: _unsafe, ...safe } = item;
    return safe;
  }
}
