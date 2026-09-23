import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Siglas con una sonrisa en arco debajo, en el color de acento (AWS).
 */
export class SmileEmblem extends CanEmblem {
  private static readonly TEXT = { lift: -0.12, scale: 0.9 };
  private static readonly ARC = { y: -0.25, radius: 0.55, from: 0.28, to: 0.72 };

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    const { lift, scale } = SmileEmblem.TEXT;
    this.glyph(context, flavor.glyph, { ...box, y: box.y + box.size * lift }, scale);
    const { y, radius, from, to } = SmileEmblem.ARC;
    context.strokeStyle = flavor.accent;
    context.beginPath();
    context.arc(box.x, box.y + box.size * y, box.size * radius, Math.PI * from, Math.PI * to);
    context.stroke();
    context.strokeStyle = flavor.ink;
  }
}
