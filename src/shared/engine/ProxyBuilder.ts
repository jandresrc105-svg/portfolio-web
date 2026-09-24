import { MeshBasicMaterial, MeshStandardMaterial, type Material, type Mesh, type Texture } from 'three';
import { ProxyAtlas } from './ProxyAtlas';
import { ProxyBatch } from './ProxyBatch';
import type { ProxyGroup } from './ProxyGroup';
import type { ProxyKey } from './ProxyKey';
import type { ProxyKind } from './ProxyKind';
import type { ProxySource } from './ProxySource';

/**
 * Arma los lotes de un grupo de la versión unida (patrón Builder): si las mallas tienen texturas distintas las
 * reparte en tandas que quepan en un atlas cada una, y guarda cómo estaba cada malla al copiarla.
 */
export class ProxyBuilder {
  private static readonly ATLAS = { scale: 0.5, size: 4096 };

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
   * @param meshes Mallas del grupo (dos o más).
   * @param rigid Si el lote es articulado (sus mallas se mueven).
   * @returns Grupo armado (vacío si no se pudo unir).
   */
  public build(kind: ProxyKind, meshes: readonly Mesh[], rigid = false): ProxyGroup {
    const [first] = meshes;
    const chunks = first && this.keys.atlased(first) ? this.chunks(meshes) : [meshes];
    const batches: ProxyBatch[] = [];
    const sources: ProxySource[] = [];
    chunks.forEach((chunk) => {
      const batch = this.batch(kind, chunk, {
        atlased: first !== undefined && this.keys.atlased(first),
        rigid,
      });
      if (batch) {
        batches.push(batch);
        sources.push(...chunk.map((mesh) => ProxyBuilder.snapshot(mesh, rigid)));
      }
    });
    return { meshes, batches, sources };
  }

  /**
   * Crea un lote (con su atlas si hace falta), o `null` si no tiene con quién unirse o no se pudo.
   *
   * @param kind Tipo de lote.
   * @param meshes Mallas del lote.
   * @param options Cómo se arma.
   * @param options.atlased Si sus texturas van en un atlas.
   * @param options.rigid Si es articulado.
   * @returns Lote o `null`.
   */
  private batch(
    kind: ProxyKind,
    meshes: readonly Mesh[],
    { atlased, rigid }: { atlased: boolean; rigid: boolean },
  ): ProxyBatch | null {
    const [first] = meshes;
    if (!first || meshes.length < 2) {
      return null;
    }
    const { scale, size } = ProxyBuilder.ATLAS;
    const atlas = atlased ? new ProxyAtlas(this.texturesOf(meshes), scale, size) : null;
    try {
      return new ProxyBatch(kind, meshes, { atlas, layers: this.keys.layersOf(first), rigid });
    } catch {
      atlas?.texture.dispose();
      return null;
    }
  }

  /**
   * Parte un grupo de mallas con textura en tandas cuyas texturas quepan en un atlas.
   *
   * @param meshes Mallas del grupo.
   * @returns Tandas.
   */
  private chunks(meshes: readonly Mesh[]): Mesh[][] {
    const { scale, size } = ProxyBuilder.ATLAS;
    const chunks: Mesh[][] = [[]];
    meshes.forEach((mesh) => {
      const current = chunks[chunks.length - 1] ?? [];
      const textures = this.texturesOf([...current, mesh]);
      if (current.length > 0 && !ProxyAtlas.fits(textures, scale, size)) {
        chunks.push([mesh]);
      } else {
        current.push(mesh);
      }
    });
    return chunks;
  }

  /**
   * Texturas de color (sin repetir) de unas mallas.
   *
   * @param meshes Mallas.
   * @returns Texturas.
   */
  private texturesOf(meshes: readonly Mesh[]): Texture[] {
    const maps = meshes.map((mesh) => ProxyBuilder.mapOf(mesh.material as Material));
    return [...new Set(maps.filter((map): map is Texture => map !== null))];
  }

  /**
   * Estado de una malla al copiarla.
   *
   * @param mesh Malla.
   * @param rigid Si va en un lote articulado.
   * @returns Estado copiado.
   */
  private static snapshot(mesh: Mesh, rigid: boolean): ProxySource {
    const material = mesh.material as Material;
    const map = ProxyBuilder.mapOf(material);
    const matrix = mesh.matrixWorld.clone();
    return { mesh, matrix, material, map, version: map?.version ?? 0, visible: mesh.visible, rigid };
  }
}
