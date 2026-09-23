import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Hoja alargada con su nervio (MongoDB).
 */
export class LeafEmblem extends CanEmblem {
  private static readonly LEAF = { top: -0.56, bottom: 0.42, bulge: 0.5, stem: 0.58 };

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    const { top, bottom, bulge, stem } = LeafEmblem.LEAF;
    const tipY = box.y + box.size * top;
    const baseY = box.y + box.size * bottom;
    const width = box.size * bulge;
    context.beginPath();
    context.moveTo(box.x, tipY);
    context.quadraticCurveTo(box.x + width, box.y, box.x, baseY);
    context.quadraticCurveTo(box.x - width, box.y, box.x, tipY);
    context.fill();
    context.strokeStyle = flavor.shade;
    context.beginPath();
    context.moveTo(box.x, tipY);
    context.lineTo(box.x, box.y + box.size * stem);
    context.stroke();
    context.strokeStyle = flavor.ink;
  }
}
