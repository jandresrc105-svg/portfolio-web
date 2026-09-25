import { BufferAttribute, BufferGeometry, type Material, type Mesh } from 'three';
import type { ProxyPart } from './ProxyPart';

/**
 * Divide las mallas originales en partes para la versión unida: una malla con un solo material es una parte;
 * una con varios materiales (una caja con una cara impresa, p. ej.) da una parte por grupo, con una geometría
 * que comparte sus vértices y lleva solo los triángulos del grupo (three.js dibuja una malla así grupo por
 * grupo, con un dibujo cada uno). Las geometrías de los grupos se arman una vez por geometría original.
 */
export class ProxyParts {
  private readonly pieces = new WeakMap<BufferGeometry, BufferGeometry[]>();

  /**
   * Material actual de una parte de una malla.
   *
   * @param mesh Malla.
   * @param slot Posición del material (-1 si la malla tiene uno solo).
   * @returns Material, o `null` si la malla ya no tiene esa forma.
   */
  public static materialOf(mesh: Mesh, slot: number): Material | null {
    const material = mesh.material;
    if (slot < 0) {
      return Array.isArray(material) ? null : material;
    }
    return Array.isArray(material) ? (material[slot] ?? null) : null;
  }

  /**
   * Partes de una malla.
   *
   * @param mesh Malla.
   * @returns Partes, o `null` si tiene varios materiales y no se puede dividir (geometría sin índice o sin
   * grupos).
   */
  public of(mesh: Mesh): ProxyPart[] | null {
    const { material, geometry } = mesh;
    if (!Array.isArray(material)) {
      return [{ mesh, material, geometry, slot: -1 }];
    }
    const index = geometry.index;
    if (!index || geometry.groups.length === 0) {
      return null;
    }
    const pieces = this.split(geometry, index);
    const parts = geometry.groups.map((group, index) => {
      const slot = group.materialIndex ?? 0;
      const own = material[slot];
      const piece = pieces[index];
      return own && piece ? { mesh, material: own, geometry: piece, slot } : null;
    });
    return parts.every((part): part is ProxyPart => part !== null) ? parts : null;
  }

  /**
   * Geometrías de los grupos de una geometría (se arman la primera vez).
   *
   * @param geometry Geometría con grupos.
   * @param index Su índice.
   * @returns Una geometría por grupo.
   */
  private split(geometry: BufferGeometry, index: BufferAttribute): BufferGeometry[] {
    const known = this.pieces.get(geometry);
    if (known) {
      return known;
    }
    const pieces = geometry.groups.map(({ start, count }) => {
      const piece = new BufferGeometry();
      Object.entries(geometry.attributes).forEach(([name, attribute]) => {
        piece.setAttribute(name, attribute);
      });
      piece.setIndex(new BufferAttribute(index.array.slice(start, start + count), 1));
      return piece;
    });
    this.pieces.set(geometry, pieces);
    return pieces;
  }
}
