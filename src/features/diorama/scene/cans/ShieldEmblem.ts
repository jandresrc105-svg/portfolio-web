import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Siglas dentro de un escudo (Angular).
 */
export class ShieldEmblem extends CanEmblem {
  private static readonly OUTLINE = [
    { x: 0, y: -0.55 },
    { x: 0.52, y: -0.36 },
    { x: 0.43, y: 0.3 },
    { x: 0, y: 0.56 },
    { x: -0.43, y: 0.3 },
    { x: -0.52, y: -0.36 },
  ];
  private static readonly TEXT = 0.7;

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    const points = ShieldEmblem.OUTLINE.map(({ x, y }) => ({
      x: box.x + x * box.size,
      y: box.y + y * box.size,
    }));
    this.polygon(context, points);
    context.stroke();
    this.glyph(context, flavor.glyph, box, ShieldEmblem.TEXT);
  }
}
