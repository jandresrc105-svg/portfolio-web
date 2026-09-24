import {
  BufferAttribute,
  DetachedBindMode,
  Matrix4,
  Skeleton,
  SkinnedMesh,
  type Bone,
  type BufferGeometry,
  type Material,
  type Mesh,
} from 'three';

/**
 * Esqueleto rígido de un lote articulado: cada malla original es un hueso y sus vértices quedan en su propio
 * espacio, atados solo a ella. En cada frame three.js lleva los vértices al mundo con la matriz actual de su
 * malla (skinning con un solo hueso por vértice), así lo que se mueve (un personaje, un farol que se mece, una
 * perilla que gira) se dibuja unido sin rearmar nada.
 */
export class ProxyRig {
  private static readonly INFLUENCES = 4;
  private static readonly WEIGHT = [1, 0, 0, 0];
  private static readonly SCALE_TOLERANCE = 1e-3;
  private static readonly COLUMN = { x: 0, y: 4, z: 8 };

  /**
   * Si una malla puede ir en un lote articulado: su escala en el mundo tiene que ser pareja, porque el
   * skinning gira las normales con la misma matriz que los vértices y con una escala despareja se torcerían.
   *
   * @param mesh Malla original.
   * @returns `true` si se puede articular sin cambiar su sombreado.
   */
  public fits(mesh: Mesh): boolean {
    const [x = 0, y = 0, z = 0] = ProxyRig.scales(mesh.matrixWorld);
    const largest = Math.max(x, y, z);
    const smallest = Math.min(x, y, z);
    return smallest > 0 && largest / smallest - 1 < ProxyRig.SCALE_TOLERANCE;
  }

  /**
   * Ata todos los vértices de una geometría (en el espacio de su malla) a un hueso.
   *
   * @param geometry Copia de la geometría de la malla.
   * @param bone Índice del hueso (la posición de la malla en el lote).
   */
  public attach(geometry: BufferGeometry, bone: number): void {
    const count = geometry.getAttribute('position').count;
    const indices = new Uint16Array(count * ProxyRig.INFLUENCES);
    const weights = new Float32Array(count * ProxyRig.INFLUENCES);
    for (let vertex = 0; vertex < count; vertex += 1) {
      indices[vertex * ProxyRig.INFLUENCES] = bone;
      weights.set(ProxyRig.WEIGHT, vertex * ProxyRig.INFLUENCES);
    }
    geometry.setAttribute('skinIndex', new BufferAttribute(indices, ProxyRig.INFLUENCES));
    geometry.setAttribute('skinWeight', new BufferAttribute(weights, ProxyRig.INFLUENCES));
  }

  /**
   * Crea la malla del lote con un hueso por malla original. Los huesos son las mallas mismas: su matriz del
   * mundo es la que mueve sus vértices, con la inversa de unión en identidad porque ya están en su espacio.
   *
   * @param geometry Geometría unida.
   * @param material Material del lote.
   * @param sources Mallas originales, en el orden de sus huesos.
   * @returns Malla articulada.
   */
  public mesh(geometry: BufferGeometry, material: Material, sources: readonly Mesh[]): SkinnedMesh {
    const mesh = new SkinnedMesh(geometry, material);
    const bones = sources as unknown as Bone[];
    mesh.bindMode = DetachedBindMode;
    mesh.bind(
      new Skeleton(
        bones,
        sources.map(() => new Matrix4()),
      ),
      new Matrix4(),
    );
    mesh.frustumCulled = false;
    return mesh;
  }

  /**
   * Largo de cada eje de una matriz (su escala).
   *
   * @param matrix Matriz.
   * @returns Escala en x, y y z.
   */
  private static scales(matrix: Matrix4): number[] {
    const elements = matrix.elements;
    const axis = (offset: number): number =>
      Math.hypot(elements[offset] ?? 0, elements[offset + 1] ?? 0, elements[offset + 2] ?? 0);
    const { x, y, z } = ProxyRig.COLUMN;
    return [axis(x), axis(y), axis(z)];
  }
}
