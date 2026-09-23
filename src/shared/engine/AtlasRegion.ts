/**
 * Rectángulo de una textura dentro de un atlas, en píxeles.
 */
export interface AtlasRegion {
  /** Borde izquierdo. */
  readonly x: number;
  /** Borde superior. */
  readonly y: number;
  /** Ancho. */
  readonly width: number;
  /** Alto. */
  readonly height: number;
}
