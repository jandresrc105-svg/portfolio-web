import type { RadioMode } from './RadioMode';

/**
 * Lo que debe sonar en el parlante del receptor en este instante.
 */
export interface RadioAudio {
  /** Nivel del ruido de fondo (0 a 1). */
  readonly noise: number;
  /** Nivel del tono demodulado (0 a 1). */
  readonly tone: number;
  /** Frecuencia del tono en Hz. */
  readonly pitch: number;
  /** Modo del receptor (elige el timbre). */
  readonly mode: RadioMode;
}
