/**
 * Indicadores de la respuesta al escalón del lazo cerrado.
 */
export interface LoopMetrics {
  /** Sobrepico, en porcentaje del escalón (0 si no lo supera). */
  readonly overshoot: number;
  /** Tiempo hasta quedar dentro de la banda del 2 % (s), o `null` si no se asienta. */
  readonly settlingTime: number | null;
  /** Tiempo de subida del 10 % al 90 % (s), o `null` si no llega. */
  readonly riseTime: number | null;
  /** Error al final del semiperiodo, en porcentaje del escalón. */
  readonly steadyError: number;
}
