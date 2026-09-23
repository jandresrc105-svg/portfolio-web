import type { Group } from 'three';

/**
 * Extremidad de dos segmentos (brazo o pierna). Cada articulación es un grupo cuyo segmento cuelga hacia -y
 * en su espacio local.
 */
export interface FigureLimb {
  /** Hombro o cadera: gira el brazo o el muslo. */
  readonly upper: Group;
  /** Codo o rodilla: gira el antebrazo o la pantorrilla. */
  readonly lower: Group;
  /** Mano o tobillo, en la punta del segundo segmento. */
  readonly end: Group;
}
