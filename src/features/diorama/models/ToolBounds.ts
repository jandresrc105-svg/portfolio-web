/**
 * Caja que ocupa una herramienta colgada (para su zona de clic), en metros y en su propio espacio.
 */
export interface ToolBounds {
  /** Centro horizontal. */
  readonly x: number;
  /** Centro vertical. */
  readonly y: number;
  /** Ancho. */
  readonly width: number;
  /** Alto. */
  readonly height: number;
}
