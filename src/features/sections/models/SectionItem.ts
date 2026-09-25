import type { SectionLink } from './SectionLink';

/**
 * Elemento dentro de una sección: un proyecto, una tecnología, un grupo de habilidades o un cargo.
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
  /**
   * Sabor de su lata en la máquina de la vitrina: la tecnología que representa (un `id` del catálogo
   * `CanFlavors` del diorama, p. ej. `web`, `typescript`, `react`, `unity`, `embedded`, `ai`).
   */
  readonly can?: string;
  /** Nombre serigrafiado en su placa del banco del taller, si es un proyecto ("ESP32 FEEDER"). */
  readonly board?: string;
  /** Etiqueta de su breaker en el tablero del poste, si es una etapa de la trayectoria ("ESP32"). */
  readonly breaker?: string;
  /** Enlace opcional (repositorio, demo). */
  readonly link?: SectionLink;
}
