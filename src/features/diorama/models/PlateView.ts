/**
 * Lo que muestra el dibujo del circuito del fondo del tablero.
 */
export interface PlateView {
  /** Etiqueta de cada etapa, en orden. */
  readonly labels: readonly string[];
  /**
   * Último nodo del bus al que llegó la corriente: -1 sin energía, 0 el MAIN, `i + 1` la etapa `i` y
   * `labels.length + 1` la carga final (circuito cerrado).
   */
  readonly lit: number;
  /** Etapa elegida en la vitrina (se remarca). */
  readonly selected: number;
}
