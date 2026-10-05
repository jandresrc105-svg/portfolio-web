/**
 * Ajustes del post-procesado que pueden cambiar en vivo (p. ej. entre el día y la noche).
 */
export interface LensSettings {
  /** Intensidad del bloom. */
  readonly bloom: number;
  /** Luminancia desde la que algo brilla con bloom. */
  readonly threshold: number;
  /** Oscuridad de la viñeta en los bordes. */
  readonly vignette: number;
}
