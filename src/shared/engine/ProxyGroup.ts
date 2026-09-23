import type { Mesh } from 'three';
import type { ProxyBatch } from './ProxyBatch';
import type { ProxySource } from './ProxySource';

/**
 * Un grupo de la versión unida (mallas con la misma clave) con los lotes que se armaron para él y cómo estaban
 * sus mallas al armarlos. Si en el siguiente rearmado el grupo tiene las mismas mallas y ninguna cambió, se
 * reutiliza tal cual.
 */
export interface ProxyGroup {
  /** Mallas del grupo, en orden. */
  readonly meshes: readonly Mesh[];
  /** Lotes armados (uno, o varios si las texturas no cupieron en un solo atlas). */
  readonly batches: readonly ProxyBatch[];
  /** Estado de cada malla al armar los lotes. */
  readonly sources: readonly ProxySource[];
}
