import type { SectionLink } from './SectionLink';

/**
 * Elemento dentro de una sección: un proyecto, un grupo de habilidades o un cargo.
 */
export interface SectionItem {
  /** Título del elemento. */
  readonly title: string;
  /** Dato secundario: fechas, rol, categoría. */
  readonly meta?: string;
  /** Descripción. */
  readonly description: string;
  /** Etiquetas (tecnologías, herramientas). */
  readonly tags?: readonly string[];
  /** Enlace opcional (repositorio, demo). */
  readonly link?: SectionLink;
}
