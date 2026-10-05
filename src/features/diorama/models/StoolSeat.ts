import type { Vector3Like } from 'three';

/**
 * Taburete donde se sienta un personaje: dónde queda sentado y cómo apoya pies y manos. Las medidas de pies y
 * manos van en el espacio del personaje sentado (+z al frente, +x a su izquierda) y son las del lado izquierdo:
 * el derecho es su espejo.
 */
export interface StoolSeat {
  /** Posición de la raíz sentado (en el mundo). */
  readonly seat: Vector3Like;
  /** Hacia dónde mira sentado (giro alrededor del eje vertical). */
  readonly heading: number;
  /** Tobillo izquierdo sentado (en el reposapiés o en el piso). */
  readonly foot: Vector3Like;
  /** Mano izquierda apoyada en la barra o la mesa mientras se sienta o se levanta. */
  readonly support: Vector3Like;
  /** Inclinación del torso sentado. */
  readonly lean: number;
  /** Cuánto baja la cabeza sentado. */
  readonly look: number;
}
