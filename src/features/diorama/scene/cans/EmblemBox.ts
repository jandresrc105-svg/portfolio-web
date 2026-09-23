/**
 * Zona donde se dibuja el emblema de una lata, en píxeles del canvas de la etiqueta.
 */
export interface EmblemBox {
  /** Centro horizontal. */
  readonly x: number;
  /** Centro vertical. */
  readonly y: number;
  /** Lado del cuadrado que ocupa el emblema. */
  readonly size: number;
}
