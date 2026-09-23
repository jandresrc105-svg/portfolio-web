import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Siglas dentro de un hexágono con punta arriba (Node.js).
 */
export class HexagonEmblem extends CanEmblem {
  private static readonly HEX = { sides: 6, radius: 0.55, text: 0.72 };

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    const { sides, radius, text } = HexagonEmblem.HEX;
    this.polygon(context, this.regular(box, sides, radius, -Math.PI / 2));
    context.stroke();
    this.glyph(context, flavor.glyph, box, text);
  }
}
