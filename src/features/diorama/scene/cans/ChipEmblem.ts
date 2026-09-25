import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Microcontrolador visto desde arriba: encapsulado, núcleo y patas en los cuatro lados (sistemas embebidos).
 */
export class ChipEmblem extends CanEmblem {
  private static readonly BODY = { size: 0.62, core: 0.24 };
  private static readonly PINS = { count: 3, spacing: 0.18, length: 0.16 };
  private static readonly SIDES = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { size, core } = ChipEmblem.BODY;
    const body = box.size * size;
    context.strokeRect(box.x - body / 2, box.y - body / 2, body, body);
    const inner = box.size * core;
    context.fillRect(box.x - inner / 2, box.y - inner / 2, inner, inner);
    context.beginPath();
    ChipEmblem.SIDES.forEach((side) => {
      this.pins(context, box, side);
    });
    context.stroke();
  }

  /**
   * Patas de un lado del chip.
   *
   * @param context Contexto 2D.
   * @param box Zona del emblema.
   * @param side Dirección del lado (hacia afuera).
   * @param side.x Componente horizontal.
   * @param side.y Componente vertical.
   */
  private pins(context: CanvasRenderingContext2D, box: EmblemBox, side: { x: number; y: number }): void {
    const { count, spacing, length } = ChipEmblem.PINS;
    const edge = (box.size * ChipEmblem.BODY.size) / 2;
    for (let index = 0; index < count; index += 1) {
      const offset = (index - (count - 1) / 2) * spacing * box.size;
      const x = box.x + side.x * edge + side.y * offset;
      const y = box.y + side.y * edge + side.x * offset;
      context.moveTo(x, y);
      context.lineTo(x + side.x * length * box.size, y + side.y * length * box.size);
    }
  }
}
