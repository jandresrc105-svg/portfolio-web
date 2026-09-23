import { Light, Line, Mesh, Points, Sprite, type Object3D } from 'three';

/**
 * Subárboles que la versión unida cubre por completo: todo lo que dibujan está en los lotes y no tienen luces.
 * Mientras la versión unida está activa se ocultan enteros (`visible = false`), así three.js ni siquiera los
 * recorre al armar la lista de dibujo; al desactivarse se vuelven a mostrar solo los que se ocultaron aquí.
 */
export class ProxyCover {
  private covered: Object3D[] = [];
  private hidden: Object3D[] = [];

  /**
   * Calcula los subárboles cubiertos más altos.
   *
   * @param roots Raíces de la zona.
   * @param proxied Mallas que están en los lotes.
   */
  public compute(roots: readonly Object3D[], proxied: ReadonlySet<Object3D>): void {
    const marks = new Map<Object3D, boolean>();
    roots.forEach((root) => this.mark(root, proxied, marks));
    this.covered = [];
    roots.forEach((root) => {
      this.pick(root, marks);
    });
  }

  /**
   * Si un nodo lo ocultó esta cubierta (y no la pieza).
   *
   * @param node Nodo.
   * @returns `true` si está oculto por la cubierta.
   */
  public hides(node: Object3D): boolean {
    return this.hidden.includes(node);
  }

  /**
   * Oculta los subárboles cubiertos que estén visibles.
   */
  public hide(): void {
    this.hidden = this.covered.filter((node) => node.visible);
    this.hidden.forEach((node) => {
      node.visible = false;
    });
  }

  /**
   * Vuelve a mostrar lo que se ocultó.
   */
  public show(): void {
    this.hidden.forEach((node) => {
      node.visible = true;
    });
    this.hidden = [];
  }

  /**
   * Marca, de abajo hacia arriba, qué nodos están cubiertos.
   *
   * @param node Nodo.
   * @param proxied Mallas en los lotes.
   * @param marks Marcas por nodo.
   * @returns `true` si el nodo y todo lo que cuelga de él está cubierto.
   */
  private mark(node: Object3D, proxied: ReadonlySet<Object3D>, marks: Map<Object3D, boolean>): boolean {
    const children = node.children.map((child) => this.mark(child, proxied, marks));
    const covered = !(node instanceof Light) && (!ProxyCover.draws(node) || proxied.has(node));
    const all = covered && children.every(Boolean);
    marks.set(node, all);
    return all;
  }

  /**
   * Elige los nodos cubiertos más altos (no hace falta ocultar lo que ya queda oculto por su padre).
   *
   * @param node Nodo.
   * @param marks Marcas por nodo.
   */
  private pick(node: Object3D, marks: ReadonlyMap<Object3D, boolean>): void {
    if (marks.get(node) === true) {
      this.covered.push(node);
      return;
    }
    node.children.forEach((child) => {
      this.pick(child, marks);
    });
  }

  /**
   * Si un nodo dibuja algo ahora (visible y con algún material visible).
   *
   * @param node Nodo.
   * @returns `true` si dibuja.
   */
  private static draws(node: Object3D): boolean {
    const drawable =
      node instanceof Mesh || node instanceof Points || node instanceof Line || node instanceof Sprite;
    if (!drawable || !node.visible) {
      return false;
    }
    const material = (node as Mesh).material;
    return (Array.isArray(material) ? material : [material]).some((item) => item.visible);
  }
}
