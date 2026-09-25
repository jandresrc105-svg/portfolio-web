import { DoubleSide, Light, Mesh, MeshStandardMaterial, type Material, type Scene } from 'three';
import { GroupCompactor } from '@shared/engine/GroupCompactor';
import { RenderLayer } from '@shared/engine/RenderLayer';
import type { SceneObject } from '@shared/engine/SceneObject';

/**
 * Ajustes de render que se aplican una vez, con el diorama ya armado, para que cada frame cueste menos sin
 * cambiar la imagen:
 * - De las piezas luminosas, solo lo que brilla entra en la capa que reflejan los charcos: en un charco de
 *   noche únicamente se distinguen las luces, y reflejar carcasas oscuras costaba draw calls sin verse.
 * - El espejo de los charcos ve las mismas luces que la cámara (si viera menos, los materiales que salen en las
 *   dos pasadas cambiarían de variante de shader dos veces por frame).
 * - Los materiales transparentes de doble cara se dibujan en una sola pasada (three.js los dibuja dos veces y
 *   revisa su shader en cada una); aquí todos son planos, vidrios casi invisibles o luz aditiva.
 * - Las mallas con varios materiales dibujan una sola vez cada material ({@link GroupCompactor}).
 * - Las piezas que no se animan se congelan: sus mallas se unen por material y sus matrices quedan fijas.
 */
export class RenderTuning {
  /**
   * Aplica los ajustes.
   *
   * @param scene Escena con todas las piezas agregadas.
   * @param objects Todas las piezas.
   * @param animated Piezas que se actualizan cada frame (no se congelan).
   * @param luminous Piezas que se reflejan en los charcos.
   */
  public apply(
    scene: Scene,
    objects: readonly SceneObject[],
    animated: readonly SceneObject[],
    luminous: readonly SceneObject[],
  ): void {
    luminous.forEach((object) => {
      object.root.traverse((node) => {
        if (node instanceof Mesh && RenderTuning.glows(node.material as Material | Material[])) {
          node.layers.enable(RenderLayer.Reflected);
        }
      });
    });
    RenderTuning.tuneNodes(scene);
    objects
      .filter((object) => !animated.includes(object))
      .forEach((object) => {
        object.freeze();
      });
  }

  /**
   * Luces visibles para el espejo, grupos de materiales repetidos compactados y transparencias en una sola
   * pasada, nodo por nodo.
   *
   * @param scene Escena.
   */
  private static tuneNodes(scene: Scene): void {
    const compactor = new GroupCompactor();
    scene.traverse((object) => {
      if (object instanceof Light) {
        object.layers.enable(RenderLayer.Reflected);
      }
      if (object instanceof Mesh) {
        compactor.compact(object as Mesh);
        RenderTuning.singlePass(object.material as Material | Material[]);
      }
    });
  }

  /**
   * Si una malla brilla por sí misma: material sin iluminación (neones, pantallas, bombillos, shaders propios)
   * o con color emisivo.
   *
   * @param material Material o lista de materiales de una malla.
   * @returns `true` si alguno brilla.
   */
  private static glows(material: Material | Material[]): boolean {
    return (Array.isArray(material) ? material : [material]).some((item) => {
      if (!(item instanceof MeshStandardMaterial)) {
        return true;
      }
      return item.emissive.getHex() !== 0 || item.emissiveMap !== null;
    });
  }

  /**
   * Dibuja en una sola pasada los materiales transparentes de doble cara.
   *
   * @param material Material o lista de materiales de una malla.
   */
  private static singlePass(material: Material | Material[]): void {
    (Array.isArray(material) ? material : [material]).forEach((item) => {
      if (item.transparent && item.side === DoubleSide) {
        item.forceSinglePass = true;
      }
    });
  }
}
