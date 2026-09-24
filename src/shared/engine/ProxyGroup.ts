import type { ProxyBatch } from './ProxyBatch';
import type { ProxyPart } from './ProxyPart';
import type { ProxySource } from './ProxySource';

/**
 * Un grupo de la versión unida (partes de mallas con la misma clave) con los lotes que se armaron para él y cómo
 * estaban sus mallas al armarlos. Si en el siguiente rearmado el grupo tiene las mismas partes y ninguna cambió,
 * se reutiliza tal cual.
 */
export interface ProxyGroup {
  /** Partes del grupo, en orden. */
  readonly parts: readonly ProxyPart[];
  /** Lotes armados (uno, o varios si las texturas no cupieron en un solo atlas). */
  readonly batches: readonly ProxyBatch[];
  /** Estado de cada malla al armar los lotes. */
  readonly sources: readonly ProxySource[];
}
