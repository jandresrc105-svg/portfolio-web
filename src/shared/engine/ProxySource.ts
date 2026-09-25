import type { Material, Matrix4, Mesh, Texture } from 'three';

/**
 * Malla original (o una de sus partes, si tiene varios materiales) que está en un lote de la versión unida, con
 * el estado que tenía cuando se copió.
 */
export interface ProxySource {
  /** Malla original. */
  readonly mesh: Mesh;
  /** Matriz del mundo al copiarla. */
  readonly matrix: Matrix4;
  /** Material de la parte al copiarla. */
  readonly material: Material;
  /** Textura de color al copiarla. */
  readonly map: Texture | null;
  /** Versión de esa textura al copiarla (cambia si se redibuja). */
  readonly version: number;
  /** Visibilidad al copiarla. */
  readonly visible: boolean;
  /** Si está en un lote articulado (moverse no la saca del lote). */
  readonly rigid: boolean;
  /** Posición del material de la parte en la lista de la malla (-1 si la malla tiene uno solo). */
  readonly slot: number;
}
