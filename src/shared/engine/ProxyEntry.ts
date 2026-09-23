import type { Material } from 'three';

/**
 * Un material original dentro de un lote de la versión unida: dónde están sus vértices y qué valores se
 * copiaron la última vez.
 */
export interface ProxyEntry {
  /** Material original, del que se leen los valores. */
  readonly material: Material;
  /** Rangos de vértices (inicio y cantidad) de sus mallas en la geometría unida. */
  readonly ranges: { start: number; count: number }[];
  /** Últimos valores copiados a los vértices. */
  readonly last: Float32Array;
}
