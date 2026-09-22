/**
 * Muestra de un lazo de control en un instante.
 */
export interface SignalSample {
  /** Valor de referencia (setpoint) normalizado [-1, 1]. */
  readonly setpoint: number;
  /** Salida del sistema controlado normalizada [-1, 1]. */
  readonly output: number;
}
