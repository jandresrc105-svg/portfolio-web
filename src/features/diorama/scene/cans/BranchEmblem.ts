import type { Vector2Like } from 'three';
import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Grafo de commits con una rama que se separa (Git · CI/CD).
 */
export class BranchEmblem extends CanEmblem {
  private static readonly TRUNK = { x: -0.2, top: -0.48, bottom: 0.48 };
  private static readonly BRANCH = { x: 0.26, y: -0.22, fork: 0.26 };
  private static readonly NODES = [
    { x: -0.2, y: -0.4 },
    { x: -0.2, y: 0.4 },
    { x: 0.26, y: -0.22 },
  ];
  private static readonly NODE_RADIUS = 0.1;

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { TRUNK: trunk, BRANCH: branch } = BranchEmblem;
    const top = BranchEmblem.at(box, trunk.x, trunk.top);
    const bottom = BranchEmblem.at(box, trunk.x, trunk.bottom);
    const fork = BranchEmblem.at(box, trunk.x, branch.fork);
    const tip = BranchEmblem.at(box, branch.x, branch.y);
    context.beginPath();
    context.moveTo(top.x, top.y);
    context.lineTo(bottom.x, bottom.y);
    context.moveTo(fork.x, fork.y);
    context.quadraticCurveTo(tip.x, fork.y, tip.x, tip.y);
    context.stroke();
    BranchEmblem.NODES.forEach(({ x, y }) => {
      const node = BranchEmblem.at(box, x, y);
      context.beginPath();
      context.arc(node.x, node.y, box.size * BranchEmblem.NODE_RADIUS, 0, Math.PI * 2);
      context.fill();
    });
  }

  /**
   * Punto del emblema a partir de coordenadas relativas a su tamaño.
   *
   * @param box Zona del emblema.
   * @param x Horizontal relativa al centro.
   * @param y Vertical relativa al centro.
   * @returns Punto en píxeles.
   */
  private static at(box: EmblemBox, x: number, y: number): Vector2Like {
    return { x: box.x + box.size * x, y: box.y + box.size * y };
  }
}
