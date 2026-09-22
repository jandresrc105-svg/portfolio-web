import type { Vector3Like } from 'three';

/**
 * Encuadre de cámara: desde dónde mira y hacia dónde.
 */
export interface CameraShot {
  /** Posición de la cámara. */
  readonly position: Vector3Like;
  /** Punto al que mira la cámara. */
  readonly target: Vector3Like;
}
