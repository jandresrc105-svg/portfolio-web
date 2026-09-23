import { CanEmblem } from './CanEmblem';
import type { EmblemBox } from './EmblemBox';

/**
 * Contenedores apilados sobre un casco (Docker · Linux).
 */
export class BoxesEmblem extends CanEmblem {
  private static readonly ROWS = [
    { count: 1, y: -0.38 },
    { count: 3, y: -0.12 },
  ];
  private static readonly BOX = { size: 0.2, gap: 0.05, line: 0.6 };
  private static readonly HULL = { half: 0.58, deck: 0.1, keel: 0.5 };

  /**
   * @inheritdoc
   */
  public draw(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { size, gap, line } = BoxesEmblem.BOX;
    const side = box.size * size;
    const pitch = side + box.size * gap;
    const width = context.lineWidth;
    context.lineWidth = width * line;
    BoxesEmblem.ROWS.forEach(({ count, y }) => {
      for (let index = 0; index < count; index += 1) {
        const x = box.x + (index - (count - 1) / 2) * pitch;
        context.strokeRect(x - side / 2, box.y + box.size * y - side / 2, side, side);
      }
    });
    context.lineWidth = width;
    this.hull(context, box);
  }

  /**
   * Casco del barco bajo los contenedores.
   *
   * @param context Contexto 2D.
   * @param box Zona del emblema.
   */
  private hull(context: CanvasRenderingContext2D, box: EmblemBox): void {
    const { half, deck, keel } = BoxesEmblem.HULL;
    const deckY = box.y + box.size * deck;
    context.beginPath();
    context.moveTo(box.x - box.size * half, deckY);
    context.lineTo(box.x + box.size * half, deckY);
    context.quadraticCurveTo(box.x, box.y + box.size * keel, box.x - box.size * half, deckY);
    context.stroke();
  }
}
