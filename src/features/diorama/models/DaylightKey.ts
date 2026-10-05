import type { LensSettings } from '@shared/engine/LensSettings';
import type { DaylightEnvironments } from './DaylightEnvironments';

/**
 * Momento clave del paso entre la noche y el día: entre dos momentos clave todo se mezcla.
 */
export interface DaylightKey {
  /** Dónde cae en la escala del día (0 = noche, 1 = día). */
  readonly at: number;
  /** Mapa de entorno del momento. */
  readonly environment: keyof DaylightEnvironments;
  /** Intensidad del mapa de entorno. */
  readonly intensity: number;
  /** Bloom, umbral y viñeta del momento. */
  readonly lens: LensSettings;
}
