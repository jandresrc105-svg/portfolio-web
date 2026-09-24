import type { WaterfallColor } from '../../models/WaterfallColor';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Historial de la cascada del SDR: un canvas chico con un píxel por bin y una fila por cuadro, usado como
 * búfer circular. Cada cuadro escribe solo la fila nueva y la pantalla lo copia en dos tramos (de la fila
 * más nueva hacia abajo), ampliado sin suavizado. Se ve igual que desplazar la pantalla una fila con
 * `drawImage` sobre sí misma y pintar la fila nueva bin por bin, pero sin copiar todo el canvas cada vez.
 */
export class WaterfallHistory {
  private static readonly PIXEL = { stride: 4, green: 1, blue: 2, alpha: 3, opaque: 255 };

  private readonly context: CanvasRenderingContext2D;
  private readonly row: ImageData;
  private head = 0;

  /**
   * Crea el historial (en negro).
   *
   * @param size Bins por fila y filas guardadas.
   * @param size.bins Bins del espectro (ancho en píxeles).
   * @param size.rows Filas de la cascada.
   * @param palette Colores de la cascada, del nivel más bajo al más alto.
   * @param colors Color de un nivel fuera de la paleta y color de la cascada vacía.
   * @param colors.fallback Nivel fuera de la paleta.
   * @param colors.blank Cascada vacía (CSS).
   */
  public constructor(
    private readonly size: { bins: number; rows: number },
    private readonly palette: readonly WaterfallColor[],
    private readonly colors: { fallback: WaterfallColor; blank: string },
  ) {
    this.context = CanvasTextureFactory.surface(size.bins, size.rows);
    this.row = this.context.createImageData(size.bins, 1);
    this.clear();
  }

  /**
   * Borra la cascada (al apagar el receptor).
   */
  public clear(): void {
    this.context.fillStyle = this.colors.blank;
    this.context.fillRect(0, 0, this.size.bins, this.size.rows);
    this.head = 0;
  }

  /**
   * Agrega arriba la fila del espectro actual (la más vieja se pierde).
   *
   * @param spectrum Espectro de la banda (0 a 1), un valor por bin.
   */
  public push(spectrum: Float32Array): void {
    const { stride, green, blue, alpha, opaque } = WaterfallHistory.PIXEL;
    const data = this.row.data;
    const last = this.palette.length - 1;
    for (let index = 0; index < this.size.bins; index += 1) {
      const color = this.palette[Math.round((spectrum[index] ?? 0) * last)] ?? this.colors.fallback;
      const offset = index * stride;
      data[offset] = color.r;
      data[offset + green] = color.g;
      data[offset + blue] = color.b;
      data[offset + alpha] = opaque;
    }
    this.head = (this.head + this.size.rows - 1) % this.size.rows;
    this.context.putImageData(this.row, 0, this.head);
  }

  /**
   * Copia la cascada a la pantalla, la fila más nueva arriba.
   *
   * @param target Contexto de la pantalla.
   * @param area Franja de la cascada en la pantalla (una fila de píxeles por fila guardada).
   * @param area.top Borde superior.
   * @param area.width Ancho.
   */
  public drawTo(target: CanvasRenderingContext2D, area: { top: number; width: number }): void {
    const { bins, rows } = this.size;
    const canvas = this.context.canvas;
    const newer = rows - this.head;
    const smoothing = target.imageSmoothingEnabled;
    target.imageSmoothingEnabled = false;
    target.drawImage(canvas, 0, this.head, bins, newer, 0, area.top, area.width, newer);
    if (this.head > 0) {
      target.drawImage(canvas, 0, 0, bins, this.head, 0, area.top + newer, area.width, this.head);
    }
    target.imageSmoothingEnabled = smoothing;
  }
}
