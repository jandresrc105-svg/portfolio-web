import type { LoopMetrics } from './LoopMetrics';

/**
 * Un periodo de la respuesta del lazo en régimen permanente, muestreado a paso fijo.
 */
export interface LoopResponse {
  /** Salida medida y(t), desde el flanco de subida de la referencia. */
  readonly output: Float32Array;
  /** Paso entre muestras (s). */
  readonly step: number;
  /** Indicadores del escalón de subida. */
  readonly metrics: LoopMetrics;
}
