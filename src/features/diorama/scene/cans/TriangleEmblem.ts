import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Triángulo con un triángulo invertido dentro (Three.js · WebGL).
 */
export class TriangleEmblem extends CanEmblem {
  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const half = box.size / 2;
    const outer = [
      { x: box.x, y: box.y - half },
      { x: box.x + half, y: box.y + half },
      { x: box.x - half, y: box.y + half },
    ];
    const inner = outer.map((point, index) => {
      const next = outer[(index + 1) % outer.length] ?? point;
      return { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    });
    [outer, inner].forEach((points) => {
      this.polygon(context, points);
      context.stroke();
    });
  }
}
