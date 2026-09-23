import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Cilindro de base de datos con discos apilados (SQL · PostgreSQL).
 */
export class DatabaseEmblem extends CanEmblem {
  private static readonly DRUM = { radius: 0.42, lid: 0.13, top: -0.4, bottom: 0.4 };
  private static readonly BANDS = [{ y: -0.13 }, { y: 0.14 }, { y: 0.4 }];

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { radius, lid, top, bottom } = DatabaseEmblem.DRUM;
    const rx = box.size * radius;
    const ry = box.size * lid;
    const topY = box.y + box.size * top;
    const bottomY = box.y + box.size * bottom;
    context.beginPath();
    context.ellipse(box.x, topY, rx, ry, 0, 0, Math.PI * 2);
    context.moveTo(box.x - rx, topY);
    context.lineTo(box.x - rx, bottomY);
    context.moveTo(box.x + rx, topY);
    context.lineTo(box.x + rx, bottomY);
    context.stroke();
    DatabaseEmblem.BANDS.forEach(({ y }) => {
      context.beginPath();
      context.ellipse(box.x, box.y + box.size * y, rx, ry, 0, 0, Math.PI);
      context.stroke();
    });
  }
}
