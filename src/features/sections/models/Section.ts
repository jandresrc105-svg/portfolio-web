import type { SectionItem } from './SectionItem';
import type { SectionLink } from './SectionLink';

/**
 * Sección de contenido del portafolio. Su posición en la lista define el encuadre de cámara del diorama.
 */
export interface Section {
  /** Id del ancla HTML; coincide con los puntos interactivos del diorama. */
  readonly id: string;
  /** Antetítulo corto ("01 — Sobre mí"). */
  readonly eyebrow: string;
  /** Título principal. */
  readonly title: string;
  /** Párrafos de texto. */
  readonly paragraphs: readonly string[];
  /** Lado de la pantalla donde se muestra la tarjeta, para no tapar el objeto enfocado. */
  readonly align: 'left' | 'right';
  /** Etiquetas generales. */
  readonly tags?: readonly string[];
  /** Elementos (proyectos, cargos, habilidades). */
  readonly items?: readonly SectionItem[];
  /** Enlaces de la sección. */
  readonly links?: readonly SectionLink[];
}
