import type { Material, Matrix4, Mesh, Texture } from 'three';

/**
 * Malla original que está en un lote de la versión unida, con el estado que tenía cuando se copió.
 */
export interface ProxySource {
  /** Malla original. */
  readonly mesh: Mesh;
  /** Matriz del mundo al copiarla. */
  readonly matrix: Matrix4;
  /** Material al copiarla. */
  readonly material: Material;
  /** Textura de color al copiarla. */
  readonly map: Texture | null;
  /** Versión de esa textura al copiarla (cambia si se redibuja). */
  readonly version: number;
  /** Visibilidad al copiarla. */
  readonly visible: boolean;
  /** Si está en un lote articulado (moverse no la saca del lote). */
  readonly rigid: boolean;
}
