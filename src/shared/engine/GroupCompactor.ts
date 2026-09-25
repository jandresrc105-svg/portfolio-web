import { BufferAttribute, type BufferGeometry, type Material, type Mesh } from 'three';

/**
 * Compacta los grupos de las mallas con varios materiales: three.js hace un draw call por grupo, aunque varios
 * grupos usen el mismo material (una caja con cinco caras iguales y una distinta son seis draw calls). Aquí se
 * reordenan los triángulos para que los que comparten material queden juntos y cada material sea un solo grupo.
 * La geometría se copia, así no se toca otra malla que la comparta. Se ve exactamente igual.
 */
export class GroupCompactor {
  /**
   * Compacta una malla si tiene varios materiales y grupos repetidos.
   *
   * @param mesh Malla.
   * @returns Draw calls ahorrados.
   */
  public compact(mesh: Mesh): number {
    const materials = mesh.material;
    const geometry = mesh.geometry;
    if (!Array.isArray(materials) || !geometry.index || geometry.groups.length < 2) {
      return 0;
    }
    const unique = [...new Set(materials)];
    if (unique.length >= geometry.groups.length) {
      return 0;
    }
    const saved = geometry.groups.length - unique.length;
    mesh.geometry = this.reorder(geometry, materials, unique);
    mesh.material = unique;
    return saved;
  }

  /**
   * Copia la geometría con los triángulos ordenados por material y un grupo por material.
   *
   * @param geometry Geometría original.
   * @param materials Materiales por índice de grupo original.
   * @param unique Materiales sin repetir (el nuevo orden).
   * @returns Geometría compactada.
   */
  private reorder(geometry: BufferGeometry, materials: Material[], unique: Material[]): BufferGeometry {
    const source = geometry.index?.array ?? [];
    const copy = geometry.clone();
    const indices: number[] = [];
    copy.clearGroups();
    unique.forEach((material, slot) => {
      const start = indices.length;
      geometry.groups
        .filter((group) => materials[group.materialIndex ?? 0] === material)
        .forEach((group) => {
          for (let index = group.start; index < group.start + group.count; index += 1) {
            indices.push(source[index] ?? 0);
          }
        });
      copy.addGroup(start, indices.length - start, slot);
    });
    const typed = source instanceof Uint32Array ? new Uint32Array(indices) : new Uint16Array(indices);
    copy.setIndex(new BufferAttribute(typed, 1));
    return copy;
  }
}
