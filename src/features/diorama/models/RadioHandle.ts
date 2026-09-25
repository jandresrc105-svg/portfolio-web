import type { MeshStandardMaterial } from 'three';
import type { WorkshopControl } from './WorkshopControl';

/**
 * Control de la estación de radio con el material que se ilumina al señalarlo.
 */
export interface RadioHandle extends WorkshopControl {
  /** Material que brilla cuando el puntero está encima. */
  readonly glow: MeshStandardMaterial;
}
