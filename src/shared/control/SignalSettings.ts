/**
 * Referencia del lazo: onda cuadrada simétrica que genera el osciloscopio (salida GEN).
 */
export interface SignalSettings {
  /** Amplitud (V): la referencia alterna entre +amplitud y -amplitud. */
  readonly amplitude: number;
  /** Frecuencia (Hz). */
  readonly frequency: number;
}
