import type { SectionCertificate } from './SectionCertificate';
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
  /** Muestra los elementos de uno en uno como vitrina navegable (cada uno enlazado a un objeto 3D). */
  readonly showcase?: boolean;
  /** Muestra el panel para sintonizar en vivo el PID del osciloscopio. */
  readonly tuner?: boolean;
  /** Sus enlaces son el marcado rápido del teléfono de la escena (el primero es la tecla 1). */
  readonly phone?: boolean;
  /**
   * Sus elementos son las etapas de la trayectoria: se recorren como vitrina y cada una es un breaker del
   * tablero del poste (su etiqueta sale de `breaker`).
   */
  readonly timeline?: boolean;
  /** Certificaciones: se listan en la tarjeta y son los sellos de la puerta del tablero. */
  readonly certificates?: readonly SectionCertificate[];
  /** Fecha ISO desde la que cuenta el medidor de energía del poste (inicio de la experiencia laboral). */
  readonly since?: string;
}
