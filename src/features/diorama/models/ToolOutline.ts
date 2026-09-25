/**
 * Forma de la silueta pintada de una herramienta en el tablero: un rectángulo redondeado (o un círculo) en el
 * espacio de la herramienta colgada, en metros.
 */
export interface ToolOutline {
  /** Centro horizontal. */
  readonly x: number;
  /** Centro vertical. */
  readonly y: number;
  /** Ancho. */
  readonly width: number;
  /** Alto. */
  readonly height: number;
  /** Giro en radianes (antihorario). */
  readonly angle?: number;
  /** Radio de las esquinas como fracción del lado menor [0, 0.5] (0.5 = píldora o círculo). */
  readonly round?: number;
}
