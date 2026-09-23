import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Siglas dentro de un recuadro redondeado (TypeScript, JavaScript).
 */
export class BadgeEmblem extends CanEmblem {
  private static readonly FRAME = { corner: 0.18, text: 0.8 };

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    const half = box.size / 2;
    context.beginPath();
    context.roundRect(box.x - half, box.y - half, box.size, box.size, box.size * BadgeEmblem.FRAME.corner);
    context.stroke();
    this.glyph(context, flavor.glyph, box, BadgeEmblem.FRAME.text);
  }
}
