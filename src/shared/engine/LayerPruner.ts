import { Light, type Object3D } from 'three';

/**
 * Poda de una pasada de render que dibuja una sola capa (p. ej. el espejo de los charcos, que refleja solo lo
 * que brilla): three.js recorre el árbol completo de la escena aunque casi nada esté en esa capa, y ese
 * recorrido era la mayor parte del costo de la pasada. Al preparar la escena marca los subárboles más altos
 * sin nada de la capa y sin luces, y durante la pasada los oculta (`visible = false`) para que three.js no
 * entre en ellos; al terminar los deja exactamente como estaban. Las luces nunca se podan: la pasada tiene que
 * ver las mismas luces que el render principal para que los shaders no cambien de variante.
 */
export class LayerPruner {
  private readonly pruned: Object3D[] = [];
  private readonly hidden: Object3D[] = [];

  /**
   * Calcula qué subárboles se pueden podar. Se llama con las capas originales (antes de que otras partes muevan
   * mallas de capa para sacarlas del render).
   *
   * @param root Raíz de la escena.
   * @param layer Capa que dibuja la pasada.
   */
  public constructor(root: Object3D, layer: number) {
    root.children.forEach((child) => {
      this.mark(child, layer);
    });
  }

  /**
   * Oculta los subárboles podables que estén visibles.
   */
  public hide(): void {
    for (const node of this.pruned) {
      if (node.visible) {
        node.visible = false;
        this.hidden.push(node);
      }
    }
  }

  /**
   * Vuelve a mostrar lo que ocultó {@link LayerPruner.hide}.
   */
  public restore(): void {
    for (const node of this.hidden) {
      node.visible = true;
    }
    this.hidden.length = 0;
  }

  /**
   * Marca un nodo si todo su subárbol se puede podar; si no, revisa sus hijos.
   *
   * @param node Nodo.
   * @param layer Capa de la pasada.
   * @returns `true` si el nodo quedó marcado entero.
   */
  private mark(node: Object3D, layer: number): boolean {
    if (!LayerPruner.needed(node, layer)) {
      this.pruned.push(node);
      return true;
    }
    node.children.forEach((child) => {
      this.mark(child, layer);
    });
    return false;
  }

  /**
   * Si un subárbol tiene algo de la capa o alguna luz.
   *
   * @param node Raíz del subárbol.
   * @param layer Capa de la pasada.
   * @returns `true` si la pasada lo necesita.
   */
  private static needed(node: Object3D, layer: number): boolean {
    let found = false;
    node.traverse((object) => {
      found ||= object instanceof Light || object.layers.isEnabled(layer);
    });
    return found;
  }
}
