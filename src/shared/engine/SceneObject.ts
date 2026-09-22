import { Group, Mesh, Points, LineSegments, type Material, type Object3D, type Vector3Like } from 'three';

/**
 * Clase base de los objetos 3D (análoga a `Component` para el DOM, patrón Template Method).
 * - {@link SceneObject.build} construye la geometría dentro de {@link SceneObject.root}.
 * - {@link SceneObject.dispose} libera geometrías, materiales y recursos registrados con {@link SceneObject.own}.
 */
export abstract class SceneObject {
  public readonly root = new Group();

  private readonly resources: { dispose: () => void }[] = [];

  /**
   * Construye el objeto y devuelve su raíz para agregarla a la escena.
   *
   * @returns Grupo raíz del objeto.
   */
  public create(): Group {
    this.build();
    return this.root;
  }

  /**
   * Agrega el objeto completo (incluidos sus hijos) a una capa de render adicional.
   *
   * @param layer Capa a habilitar.
   */
  public enableLayer(layer: number): void {
    this.root.traverse((child) => {
      child.layers.enable(layer);
    });
  }

  /**
   * Libera todos los recursos de GPU del objeto.
   */
  public dispose(): void {
    this.root.traverse((child) => {
      if (child instanceof Mesh || child instanceof Points || child instanceof LineSegments) {
        const drawable = child as Mesh;
        drawable.geometry.dispose();
        SceneObject.disposeMaterial(drawable.material);
      }
    });
    this.resources.splice(0).forEach((resource) => {
      resource.dispose();
    });
  }

  /**
   * Construye la geometría del objeto dentro de `root`.
   */
  protected abstract build(): void;

  /**
   * Agrega un objeto hijo a la raíz, opcionalmente en una posición.
   *
   * @param object Objeto a agregar.
   * @param position Posición local.
   * @returns El mismo objeto, para seguir configurándolo.
   */
  protected add<T extends Object3D>(object: T, position?: Vector3Like): T {
    if (position) {
      object.position.copy(position);
    }
    this.root.add(object);
    return object;
  }

  /**
   * Registra un recurso (textura, render target…) para liberarlo en {@link SceneObject.dispose}.
   *
   * @param resource Recurso con método `dispose`.
   * @returns El mismo recurso.
   */
  protected own<T extends { dispose: () => void }>(resource: T): T {
    this.resources.push(resource);
    return resource;
  }

  /**
   * Libera uno o varios materiales.
   *
   * @param material Material o lista de materiales.
   */
  private static disposeMaterial(material: Material | Material[]): void {
    (Array.isArray(material) ? material : [material]).forEach((item) => {
      item.dispose();
    });
  }
}
