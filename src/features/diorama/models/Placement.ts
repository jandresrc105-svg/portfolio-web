import type { Vector3Like } from 'three';

/**
 * Dónde se coloca una pieza de la escena: posición de su origen y giro sobre el eje vertical.
 */
export interface Placement {
  /** Posición del origen de la pieza. */
  readonly position: Vector3Like;
  /** Giro en Y (radianes). */
  readonly rotationY: number;
}
