import { InstancedMesh, Matrix4, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Une las mallas estáticas de un objeto que comparten material (y capas, orden de dibujo y sombras) en una
 * sola malla: el mismo aspecto con muchos menos draw calls. Solo se usa en partes que ya no se mueven ni
 * cambian de malla o de visibilidad después de construirse: piezas enteras ({@link SceneObject.freeze}) o lo fijo
 * de una pieza animada ({@link SceneObject.settle}, que excluye lo que se mueve). Cambiar el color de un material
 * sigue funcionando porque la malla unida comparte el mismo material.
 */
export class GeometryBatcher {
  private static readonly DETAIL = new WeakMap<Object3D, number>();

  private readonly inverse = new Matrix4();
  private readonly relative = new Matrix4();

  /**
   * Radio de la parte más grande de una malla unida (en el espacio de su raíz). Sirve para descartarla desde
   * lejos igual que se descartaban sus partes sueltas, aunque la malla unida abarque más.
   *
   * @param object Malla.
   * @returns Radio, o `undefined` si la malla no es unida.
   */
  public static detailOf(object: Object3D): number | undefined {
    return GeometryBatcher.DETAIL.get(object);
  }

  /**
   * Une las mallas de un objeto.
   *
   * @param root Raíz del objeto, con sus matrices del mundo al día.
   * @param keep Nodos que no se tocan, ni ellos ni lo que cuelga de ellos (partes que se mueven, zonas de clic).
   * @returns Cuántos draw calls se ahorraron.
   */
  public batch(root: Object3D, keep: readonly Object3D[] = []): number {
    this.inverse.copy(root.matrixWorld).invert();
    let saved = 0;
    this.groups(root, new Set(keep)).forEach((meshes) => {
      if (meshes.length > 1) {
        saved += this.merge(root, meshes);
      }
    });
    return saved;
  }

  /**
   * Agrupa las mallas que se pueden unir.
   *
   * @param root Raíz del objeto.
   * @param keep Nodos excluidos.
   * @returns Grupos por clave de compatibilidad.
   */
  private groups(root: Object3D, keep: ReadonlySet<Object3D>): Map<string, Mesh[]> {
    const groups = new Map<string, Mesh[]>();
    root.traverse((object) => {
      if (!GeometryBatcher.mergeable(object) || GeometryBatcher.kept(object, root, keep)) {
        return;
      }
      const key = GeometryBatcher.key(object);
      const group = groups.get(key) ?? [];
      group.push(object);
      groups.set(key, group);
    });
    return groups;
  }

  /**
   * Reemplaza un grupo de mallas por una sola con sus geometrías llevadas al espacio de la raíz.
   *
   * @param root Raíz del objeto.
   * @param meshes Mallas del grupo (mismo material).
   * @returns Draw calls ahorrados.
   */
  private merge(root: Object3D, meshes: Mesh[]): number {
    const geometries = meshes.map((mesh) =>
      mesh.geometry.clone().applyMatrix4(this.relative.multiplyMatrices(this.inverse, mesh.matrixWorld)),
    );
    const merged = mergeGeometries(geometries) as BufferGeometry | null;
    const detail = Math.max(...geometries.map((geometry) => GeometryBatcher.radius(geometry)));
    geometries.forEach((geometry) => {
      geometry.dispose();
    });
    const [first] = meshes;
    if (!merged || !first) {
      return 0;
    }
    const mesh = GeometryBatcher.copyFlags(new Mesh(merged, first.material), first);
    root.add(GeometryBatcher.remember(mesh, detail));
    meshes.forEach((part) => part.removeFromParent());
    return meshes.length - 1;
  }

  /**
   * Si una malla se puede unir: malla simple, visible, con un solo material, sin hijos y sin espejo.
   *
   * @param object Nodo del árbol.
   * @returns `true` si se puede unir.
   */
  private static mergeable(object: Object3D): object is Mesh<BufferGeometry, Material> {
    if (!(object instanceof Mesh) || object instanceof InstancedMesh || object.children.length > 0) {
      return false;
    }
    return object.visible && !Array.isArray(object.material) && object.matrixWorld.determinant() > 0;
  }

  /**
   * Si un nodo o alguno de sus ancestros (hasta la raíz) está excluido.
   *
   * @param object Nodo.
   * @param root Raíz del objeto.
   * @param keep Nodos excluidos.
   * @returns `true` si no se debe unir.
   */
  private static kept(object: Object3D, root: Object3D, keep: ReadonlySet<Object3D>): boolean {
    for (let node: Object3D | null = object; node && node !== root; node = node.parent) {
      if (keep.has(node)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clave de compatibilidad: material, atributos, índice, capas, orden de dibujo y sombras.
   *
   * @param mesh Malla.
   * @returns Clave del grupo.
   */
  private static key(mesh: Mesh<BufferGeometry, Material>): string {
    const attributes = Object.keys(mesh.geometry.attributes).sort().join(',');
    const indexed = mesh.geometry.index ? 'i' : 'n';
    const flags = [mesh.renderOrder, mesh.castShadow, mesh.receiveShadow, mesh.frustumCulled].join(',');
    return [mesh.material.uuid, attributes, indexed, String(mesh.layers.mask), flags].join('|');
  }

  /**
   * Guarda el radio de la parte más grande de una malla unida.
   *
   * @param mesh Malla unida.
   * @param detail Radio de su parte más grande.
   * @returns La misma malla.
   */
  private static remember(mesh: Mesh, detail: number): Mesh {
    GeometryBatcher.DETAIL.set(mesh, detail);
    return mesh;
  }

  /**
   * Radio de la esfera que envuelve una geometría.
   *
   * @param geometry Geometría.
   * @returns Radio.
   */
  private static radius(geometry: BufferGeometry): number {
    geometry.computeBoundingSphere();
    return geometry.boundingSphere?.radius ?? 0;
  }

  /**
   * Copia a la malla unida las banderas de render de una del grupo.
   *
   * @param target Malla unida.
   * @param source Malla original.
   * @returns La malla unida.
   */
  private static copyFlags(target: Mesh, source: Mesh): Mesh {
    target.layers.mask = source.layers.mask;
    target.renderOrder = source.renderOrder;
    target.castShadow = source.castShadow;
    target.receiveShadow = source.receiveShadow;
    target.frustumCulled = source.frustumCulled;
    return target;
  }
}
