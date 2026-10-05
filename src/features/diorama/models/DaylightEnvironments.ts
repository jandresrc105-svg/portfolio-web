import type { Texture } from 'three';

/**
 * Mapas de entorno ya horneados de cada momento del día.
 */
export interface DaylightEnvironments {
  /** Reflejos de neón de la noche. */
  readonly night: Texture;
  /** Atardecer naranja de la tarde. */
  readonly dusk: Texture;
  /** Cielo y sol del día. */
  readonly day: Texture;
}
