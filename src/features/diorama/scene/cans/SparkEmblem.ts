import { CanEmblem } from './CanEmblem';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Destello de cuatro puntas con uno pequeño al lado (inteligencia artificial).
 */
export class SparkEmblem extends CanEmblem {
  private static readonly STARS = [
    { x: -0.08, y: 0.06, radius: 0.46 },
    { x: 0.36, y: -0.36, radius: 0.18 },
  ];
  private static readonly POINTS = 4;

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void {
    SparkEmblem.STARS.forEach(({ x, y, radius }, index) => {
      context.fillStyle = index === 0 ? flavor.ink : flavor.accent;
      this.star(context, { x: box.x + box.size * x, y: box.y + box.size * y, size: box.size * radius });
    });
    context.fillStyle = flavor.ink;
  }

  /**
   * Estrella de cuatro puntas con lados curvos hacia adentro.
   *
   * @param context Contexto 2D.
   * @param star Centro y largo de cada punta (`size`).
   */
  private star(context: CanvasRenderingContext2D, star: EmblemBox): void {
    const { x, y, size } = star;
    context.beginPath();
    context.moveTo(x, y - size);
    for (let index = 1; index <= SparkEmblem.POINTS; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / SparkEmblem.POINTS;
      context.quadraticCurveTo(x, y, x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    }
    context.fill();
  }
}
