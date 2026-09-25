import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Dos "V" anidadas (Vue): la exterior en tinta y la interior en el color de sombra de la lata.
 */
export class VeeEmblem extends CanEmblem {
  private static readonly LAYERS = [
    { half: 0.56, top: -0.42, tip: 0.48 },
    { half: 0.3, top: -0.42, tip: 0.04 },
  ];

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    VeeEmblem.LAYERS.forEach(({ half, top, tip }, index) => {
      context.fillStyle = index === 0 ? flavor.ink : flavor.shade;
      this.polygon(context, [
        { x: box.x - box.size * half, y: box.y + box.size * top },
        { x: box.x + box.size * half, y: box.y + box.size * top },
        { x: box.x, y: box.y + box.size * tip },
      ]);
      context.fill();
    });
    context.fillStyle = flavor.ink;
  }
}
