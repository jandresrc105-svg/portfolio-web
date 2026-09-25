import type { Object3D } from 'three';

/**
 * Control de un equipo del taller que recibe el puntero: una perilla, un interruptor, una herramienta.
 */
export interface WorkshopControl {
  /** Id del control, único dentro de su equipo. */
  readonly id: string;
  /** Malla (visible o invisible) donde pega el rayo del puntero. */
  readonly hitArea: Object3D;
}
