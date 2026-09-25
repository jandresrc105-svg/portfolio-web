import type { ResistorBand } from './ResistorBand';

/**
 * Código de colores de 4 bandas de un valor de resistencia, llevado al valor normalizado (serie E24) más
 * cercano.
 */
export interface ResistorCode {
  /** Bandas de izquierda a derecha: dos cifras, multiplicador y tolerancia (una sola negra para 0 Ω). */
  readonly bands: readonly ResistorBand[];
  /** Valor normalizado que indican las bandas, en ohmios. */
  readonly ohms: number;
  /** Si el valor pedido ya era un valor normalizado. */
  readonly exact: boolean;
}
