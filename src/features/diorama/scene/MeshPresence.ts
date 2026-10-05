import { Mesh, Points, type Object3D } from 'three';
import { ProxyCover } from '@shared/engine/ProxyCover';

/**
 * Hace aparecer o desaparecer lo que dibuja una pieza (o una parte), malla por malla. Se oculta cada malla y no
 * su grupo porque las versiones unidas de la zona detectan que una malla copiada se ocultó, pero no que se
 * ocultó un antecesor, y su cubierta oculta y restaura nodos por su cuenta (cada malla se marca con
 * {@link ProxyCover.toggles} para que la cubierta no la toque a ella ni a sus antecesores). Las mallas se buscan
 * la primera vez (con la pieza ya armada y unida) y {@link MeshPresence.enforce} vuelve a aplicar el estado por si
 * algo lo cambió.
 */
export class MeshPresence {
  private nodes: Object3D[] | null = null;
  private present = true;

  /**
   * Prepara la presencia de una pieza o parte.
   *
   * @param root Raíz de lo que aparece o desaparece.
   */
  public constructor(private readonly root: Object3D) {}

  /**
   * Si se ve.
   *
   * @returns `true` si está presente.
   */
  public get shown(): boolean {
    return this.present;
  }

  /**
   * Hace aparecer o desaparecer lo que dibuja.
   *
   * @param present `true` para que se vea.
   */
  public set(present: boolean): void {
    this.present = present;
    this.enforce();
  }

  /**
   * Vuelve a aplicar el estado a cada malla.
   */
  public enforce(): void {
    this.nodes ??= MeshPresence.collect(this.root);
    for (const node of this.nodes) {
      if (node.visible !== this.present) {
        node.visible = this.present;
      }
    }
  }

  /**
   * Mallas y nubes de puntos bajo una raíz.
   *
   * @param root Raíz.
   * @returns Lo que dibuja.
   */
  private static collect(root: Object3D): Object3D[] {
    const nodes: Object3D[] = [];
    root.traverse((node) => {
      if (node instanceof Mesh || node instanceof Points) {
        ProxyCover.toggles(node);
        nodes.push(node);
      }
    });
    return nodes;
  }
}
