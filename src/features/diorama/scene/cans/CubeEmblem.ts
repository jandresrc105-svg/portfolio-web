import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Cubo isométrico de aristas (Unity): hexágono con tres aristas hacia el centro.
 */
export class CubeEmblem extends CanEmblem {
  private static readonly HEX = { sides: 6, radius: 0.52 };
  private static readonly SPOKES = [{ corner: 1 }, { corner: 3 }, { corner: 5 }];

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { sides, radius } = CubeEmblem.HEX;
    const corners = this.regular(box, sides, radius, Math.PI / sides);
    this.polygon(context, corners);
    CubeEmblem.SPOKES.forEach(({ corner }) => {
      const point = corners[corner];
      if (point) {
        context.moveTo(box.x, box.y);
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  }
}
