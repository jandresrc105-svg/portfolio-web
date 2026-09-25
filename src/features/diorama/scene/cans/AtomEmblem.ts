import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Átomo de tres órbitas con núcleo (React).
 */
export class AtomEmblem extends CanEmblem {
  private static readonly ORBIT = { radiusX: 0.56, radiusY: 0.2, count: 3, line: 0.6 };
  private static readonly NUCLEUS = 0.09;

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { radiusX, radiusY, count, line } = AtomEmblem.ORBIT;
    const width = context.lineWidth;
    context.lineWidth = width * line;
    for (let index = 0; index < count; index += 1) {
      const turn = (index * Math.PI) / count;
      context.beginPath();
      context.ellipse(box.x, box.y, box.size * radiusX, box.size * radiusY, turn, 0, Math.PI * 2);
      context.stroke();
    }
    context.lineWidth = width;
    context.beginPath();
    context.arc(box.x, box.y, box.size * AtomEmblem.NUCLEUS, 0, Math.PI * 2);
    context.fill();
  }
}
