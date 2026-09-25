/**
 * Pista de la música de fondo.
 */
export interface SoundtrackTrack {
  /** Ruta del archivo en `public/`. */
  readonly src: string;
  /** Ganancia para igualar el volumen entre pistas. */
  readonly gain: number;
}
