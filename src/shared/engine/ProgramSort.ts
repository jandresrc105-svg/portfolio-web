import { MeshStandardMaterial, type Material } from 'three';
import type { RenderItem } from 'three/src/renderers/webgl/WebGLRenderLists.js';

/**
 * Orden de dibujo de los objetos opacos que agrupa los que usan el mismo shader. three.js los ordena por id de
 * material, así que materiales de distinto tipo quedan intercalados y cada cambio de programa obliga a volver a
 * subir los uniforms (incluidas todas las luces). Aquí se ordena primero por una firma del programa (tipo de
 * material y mapas que usa) y después por material y profundidad, como three.js: el resultado en pantalla es el
 * mismo.
 */
export class ProgramSort {
  private readonly ranks = new WeakMap<Material, number>();
  private readonly order = new WeakMap<Material, number>();
  private readonly signatures = new Map<string, number>();
  private seen = 0;

  /**
   * Compara dos objetos de la lista de dibujo opaca.
   *
   * @param a Primer objeto.
   * @param b Segundo objeto.
   * @returns Negativo si `a` va antes.
   */
  public compare(a: RenderItem, b: RenderItem): number {
    return (
      a.groupOrder - b.groupOrder ||
      a.renderOrder - b.renderOrder ||
      this.rank(a.material) - this.rank(b.material) ||
      this.index(a.material) - this.index(b.material) ||
      a.materialVariant - b.materialVariant ||
      a.z - b.z ||
      a.id - b.id
    );
  }

  /**
   * Número fijo de un material dentro del grupo (en el orden en que aparece por primera vez), para que los
   * objetos con el mismo material queden juntos.
   *
   * @param material Material.
   * @returns Índice del material.
   */
  private index(material: Material): number {
    let index = this.order.get(material);
    if (index === undefined) {
      index = this.seen;
      this.seen += 1;
      this.order.set(material, index);
    }
    return index;
  }

  /**
   * Número de grupo del programa de un material (se calcula una vez por material).
   *
   * @param material Material.
   * @returns Rango del grupo.
   */
  private rank(material: Material): number {
    const known = this.ranks.get(material);
    if (known !== undefined) {
      return known;
    }
    const signature = ProgramSort.signature(material);
    const rank = this.signatures.get(signature) ?? this.signatures.size;
    this.signatures.set(signature, rank);
    this.ranks.set(material, rank);
    return rank;
  }

  /**
   * Firma aproximada del programa: tipo de material y qué mapas y opciones activan variantes del shader.
   *
   * @param material Material.
   * @returns Firma.
   */
  private static signature(material: Material): string {
    const flags = [material.type, material.side, material.vertexColors, material.alphaTest > 0];
    if (material instanceof MeshStandardMaterial) {
      flags.push(
        material.map !== null,
        material.emissiveMap !== null,
        material.roughnessMap !== null,
        material.normalMap !== null,
        material.alphaMap !== null,
      );
    }
    return flags.join('|');
  }
}
