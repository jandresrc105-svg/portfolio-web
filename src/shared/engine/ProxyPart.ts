import type { BufferGeometry, Material, Mesh } from 'three';

/**
 * Parte de una malla original que entra en un lote de la versión unida: la malla entera si tiene un solo
 * material, o uno de sus grupos si tiene varios (cada grupo va al lote de su material).
 */
export interface ProxyPart {
  /** Malla original. */
  readonly mesh: Mesh;
  /** Material de la parte. */
  readonly material: Material;
  /** Geometría de la parte (la de la malla, o una que comparte sus vértices con solo los triángulos del grupo). */
  readonly geometry: BufferGeometry;
  /** Posición del material en la lista de la malla, o -1 si la malla tiene un solo material. */
  readonly slot: number;
}
