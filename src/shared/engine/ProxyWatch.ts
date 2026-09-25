import { Line, Mesh, Points, Sprite, type Matrix4, type Object3D } from 'three';

/**
 * Vigila qué se mueve en la zona (cualquier cosa que se dibuje, esté o no en los lotes). Las piezas donde nada
 * se movió pueden dejar de recalcular sus matrices mientras la versión unida siga activa; las que tienen algo
 * en movimiento (un servo, un giro interno) no. Una pieza que se movió una vez queda inquieta hasta que se
 * vuelva a empezar, y ya no se revisa.
 */
export class ProxyWatch {
  private watched: { node: Object3D; matrix: Matrix4; root: Object3D }[] = [];
  private readonly restless = new Set<Object3D>();

  /**
   * Empieza a vigilar desde el estado actual.
   *
   * @param roots Raíces de la zona (con sus matrices al día).
   */
  public start(roots: readonly Object3D[]): void {
    this.restless.clear();
    this.watched = [];
    roots.forEach((root) => {
      root.traverse((node) => {
        if (ProxyWatch.drawable(node)) {
          this.watched.push({ node, matrix: node.matrixWorld.clone(), root });
        }
      });
    });
  }

  /**
   * Revisa qué se movió desde la última revisión en las piezas que siguen quietas y anota su pieza como
   * inquieta.
   *
   * @returns `true` si alguna pieza pasó a estar inquieta.
   */
  public check(): boolean {
    let moved = false;
    for (const entry of this.watched) {
      if (!this.restless.has(entry.root) && !entry.node.matrixWorld.equals(entry.matrix)) {
        entry.matrix.copy(entry.node.matrixWorld);
        this.restless.add(entry.root);
        moved = true;
      }
    }
    return moved;
  }

  /**
   * Piezas donde no se movió nada.
   *
   * @param roots Raíces de la zona.
   * @returns Raíces quietas.
   */
  public still(roots: readonly Object3D[]): Object3D[] {
    return roots.filter((root) => !this.restless.has(root));
  }

  /**
   * Si un nodo dibuja algo.
   *
   * @param node Nodo.
   * @returns `true` si es una malla, puntos, líneas o sprite.
   */
  private static drawable(node: Object3D): boolean {
    return node instanceof Mesh || node instanceof Points || node instanceof Line || node instanceof Sprite;
  }
}
