import type { RadioCarrier } from './RadioCarrier';

/**
 * Emisora que entra por el filtro del receptor y con cuánta fuerza.
 */
export interface RadioReception {
  /** Emisora más fuerte dentro de la banda de paso, o `null` si solo hay ruido. */
  readonly station: RadioCarrier | null;
  /** Respuesta del filtro a esa emisora (1 = centrada, 0 = fuera de la banda de paso). */
  readonly response: number;
  /** Señal demodulada (0 a 1): potencia × ganancia de la antena × respuesta × acople del modo. */
  readonly signal: number;
}
