import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Emblema de solo siglas en grande (C++, .NET, Py…).
 */
export class GlyphEmblem extends CanEmblem {
  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    this.glyph(context, flavor.glyph, box);
  }
}
