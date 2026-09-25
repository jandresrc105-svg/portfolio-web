import { MeshBasicMaterial, MeshStandardMaterial, type Material, type Texture } from 'three';
import { ProxyAtlas } from './ProxyAtlas';
import { ProxyBatch } from './ProxyBatch';
import type { ProxyGroup } from './ProxyGroup';
import { ProxyKey } from './ProxyKey';
import type { ProxyKind } from './ProxyKind';
import type { ProxyPart } from './ProxyPart';
import type { ProxySource } from './ProxySource';

/**
 * Arma los lotes de un grupo de la versión unida (patrón Builder): si las mallas tienen texturas distintas las
 * reparte en tandas que quepan en un atlas cada una, y guarda cómo estaba cada malla al copiarla. Las texturas
 * van al atlas a la mitad de su tamaño, salvo las de los letreros (texturas que también dan el brillo y caras
 * impresas de mallas con varios materiales): llevan texto chico que se lee de cerca y van completas.
 */
export class ProxyBuilder {
  private static readonly ATLAS = { scale: 0.5, sharp: 1, size: 4096 };

  /**
   * Prepara el armador.
   *
   * @param keys Clasificación de mallas (dice si sus texturas van en atlas).
   */
  public constructor(private readonly keys: ProxyKey) {}

  /**
   * Textura de color de un material (si tiene).
   *
   * @param material Material.
   * @returns Textura o `null`.
   */
  public static mapOf(material: Material): Texture | null {
    return material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial
      ? material.map
      : null;
  }

  /**
   * Arma los lotes de un grupo.
   *
   * @param kind Tipo de lote.
   * @param parts Partes del grupo (dos o más).
   * @param rigid Si el lote es articulado (sus mallas se mueven).
   * @returns Grupo armado (vacío si no se pudo unir).
   */
  public build(kind: ProxyKind, parts: readonly ProxyPart[], rigid = false): ProxyGroup {
    const [first] = parts;
    const chunks = first && this.keys.atlased(first) ? this.chunks(parts) : [parts];
    const batches: ProxyBatch[] = [];
    const sources: ProxySource[] = [];
    chunks.forEach((chunk) => {
      const batch = this.batch(kind, chunk, {
        atlased: first !== undefined && this.keys.atlased(first),
        rigid,
      });
      if (batch) {
        batches.push(batch);
        sources.push(...chunk.map((part) => ProxyBuilder.snapshot(part, rigid)));
      }
    });
    return { parts, batches, sources };
  }

  /**
   * Crea un lote (con su atlas si hace falta), o `null` si no tiene con quién unirse o no se pudo.
   *
   * @param kind Tipo de lote.
   * @param parts Partes del lote.
   * @param options Cómo se arma.
   * @param options.atlased Si sus texturas van en un atlas.
   * @param options.rigid Si es articulado.
   * @returns Lote o `null`.
   */
  private batch(
    kind: ProxyKind,
    parts: readonly ProxyPart[],
    { atlased, rigid }: { atlased: boolean; rigid: boolean },
  ): ProxyBatch | null {
    const [first] = parts;
    if (!first || parts.length < 2) {
      return null;
    }
    const size = ProxyBuilder.ATLAS.size;
    const atlas = atlased ? new ProxyAtlas(this.texturesOf(parts), ProxyBuilder.scale(parts), size) : null;
    try {
      return new ProxyBatch(kind, parts, { atlas, layers: this.keys.layersOf(first.mesh), rigid });
    } catch {
      atlas?.texture.dispose();
      return null;
    }
  }

  /**
   * Parte un grupo de partes con textura en tandas cuyas texturas quepan en un atlas.
   *
   * @param parts Partes del grupo.
   * @returns Tandas.
   */
  private chunks(parts: readonly ProxyPart[]): ProxyPart[][] {
    const size = ProxyBuilder.ATLAS.size;
    const scale = ProxyBuilder.scale(parts);
    const chunks: ProxyPart[][] = [[]];
    parts.forEach((part) => {
      const current = chunks[chunks.length - 1] ?? [];
      const textures = this.texturesOf([...current, part]);
      if (current.length > 0 && !ProxyAtlas.fits(textures, scale, size)) {
        chunks.push([part]);
      } else {
        current.push(part);
      }
    });
    return chunks;
  }

  /**
   * Texturas de color (sin repetir) de unas partes.
   *
   * @param parts Partes.
   * @returns Texturas.
   */
  private texturesOf(parts: readonly ProxyPart[]): Texture[] {
    const maps = parts.map((part) => ProxyBuilder.mapOf(part.material));
    return [...new Set(maps.filter((map): map is Texture => map !== null))];
  }

  /**
   * Escala de copia al atlas de cada textura de unas partes: completa para las de los letreros, la mitad para
   * las demás.
   *
   * @param parts Partes.
   * @returns Escala por textura.
   */
  private static scale(parts: readonly ProxyPart[]): (texture: Texture) => number {
    const sharp = new Set<Texture>();
    parts.forEach(({ material, slot }) => {
      const map = ProxyBuilder.mapOf(material);
      if (map && (slot >= 0 || ProxyKey.glowsWithMap(material))) {
        sharp.add(map);
      }
    });
    const { scale, sharp: full } = ProxyBuilder.ATLAS;
    return (texture: Texture): number => (sharp.has(texture) ? full : scale);
  }

  /**
   * Estado de una parte al copiarla.
   *
   * @param part Parte de una malla.
   * @param rigid Si va en un lote articulado.
   * @returns Estado copiado.
   */
  private static snapshot(part: ProxyPart, rigid: boolean): ProxySource {
    const { mesh, material, slot } = part;
    const map = ProxyBuilder.mapOf(material);
    const matrix = mesh.matrixWorld.clone();
    return { mesh, matrix, material, map, version: map?.version ?? 0, visible: mesh.visible, rigid, slot };
  }
}
