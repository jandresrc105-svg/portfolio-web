import type { Vector3, Vector3Like } from 'three';

/**
 * Camino por el que camina un personaje con pisadas reales: dónde está cada punto, cuánto mide un paso y dónde
 * apoyar cada pie (en lo plano, a un lado del camino; en una escalera, en el centro de cada peldaño).
 */
export interface WalkPath {
  /** Largo total del camino (metros). */
  readonly length: number;
  /** Altura del tobillo sobre el suelo al pisar. */
  readonly ankle: number;
  /** Cantidad de peldaños (0 si no hay escalera). */
  readonly treads: number;

  /**
   * Punto del suelo a una distancia del principio.
   *
   * @param distance Metros recorridos.
   * @param position Vector donde se escribe el punto.
   * @returns Rumbo hacia el final del camino.
   */
  sample(distance: number, position: Vector3): number;

  /**
   * Largo de un paso en ese punto.
   *
   * @param distance Metros recorridos.
   * @returns Metros.
   */
  stepAt(distance: number): number;

  /**
   * Si un punto está sobre los peldaños.
   *
   * @param distance Metros recorridos.
   * @returns `true` en la escalera.
   */
  onStairs(distance: number): boolean;

  /**
   * Una distancia llevada afuera de los peldaños, del lado hacia donde camina.
   *
   * @param distance Metros recorridos hasta la pisada.
   * @param direction 1 hacia el final, -1 hacia el principio.
   * @returns Distancia fuera de la escalera.
   */
  offStairs(distance: number, direction: number): number;

  /**
   * Dónde apoyar un pie en lo plano.
   *
   * @param distance Metros recorridos hasta la pisada.
   * @param side 1 = pie izquierdo, -1 = derecho.
   * @param direction 1 hacia el final, -1 hacia el principio.
   * @param target Vector donde se escribe el tobillo.
   * @returns El mismo vector.
   */
  footSpot(distance: number, side: number, direction: number, target: Vector3): Vector3;

  /**
   * Dónde apoyar un pie en un peldaño.
   *
   * @param index Peldaño (0 = el de abajo).
   * @param side 1 = pie izquierdo, -1 = derecho.
   * @param direction 1 si sube, -1 si baja.
   * @param target Vector donde se escribe el tobillo.
   * @returns El mismo vector.
   */
  treadSpot(index: number, side: number, direction: number, target: Vector3): Vector3;

  /**
   * Peldaño donde está apoyado un pie.
   *
   * @param ankle Tobillo.
   * @returns Índice del peldaño o -1 si no está en la escalera.
   */
  treadOf(ankle: Vector3Like): number;
}
