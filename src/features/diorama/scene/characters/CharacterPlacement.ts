import type { Vector3Like } from 'three';

/**
 * Ubicación de un personaje en el diorama.
 */
export interface CharacterPlacement {
  /** Posición de los pies (o del punto bajo la cadera si está sentado). */
  readonly position: Vector3Like;
  /** Rotación en Y (radianes); 0 = mirando hacia +z. */
  readonly rotationY: number;
}
