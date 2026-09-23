import type { Group } from 'three';
import type { FigureLimb } from './FigureLimb';

/**
 * Articulaciones de un personaje hecho a mano, para posarlo y animarlo.
 */
export interface FigureJoints {
  /** Cadera: raíz del cuerpo. */
  readonly hips: Group;
  /** Torso (gira sobre la cadera). */
  readonly torso: Group;
  /** Cabeza (gira sobre el cuello; origen en la base de la cabeza). */
  readonly head: Group;
  /** Brazo izquierdo (+x, a la izquierda del personaje, que mira hacia +z). */
  readonly armLeft: FigureLimb;
  /** Brazo derecho (-x). */
  readonly armRight: FigureLimb;
  /** Pierna izquierda. */
  readonly legLeft: FigureLimb;
  /** Pierna derecha. */
  readonly legRight: FigureLimb;
}
