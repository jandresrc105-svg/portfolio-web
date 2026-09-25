import type { Vector3Like } from 'three';

/**
 * Punto interactivo del diorama que lleva a una sección del portafolio.
 */
export interface Hotspot {
  /** Id de la sección HTML destino. */
  readonly sectionId: string;
  /** Texto que se muestra al pasar el puntero. */
  readonly label: string;
  /** Posición del marcador en la escena. */
  readonly anchor: Vector3Like;
}
