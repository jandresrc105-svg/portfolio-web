import type { Texture } from 'three';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { CanFlavor } from './CanFlavor';

/**
 * Etiquetas de las latas dibujadas en canvas: un atlas en cuadrícula con una celda por sabor (tecnología)
 * y la tapa de aluminio con su anilla. Cada celda repite el diseño dos veces alrededor de la lata para que
 * el emblema se vea desde el frente aunque la lata gire.
 */
export class CanLabelArt {
  public static readonly COLUMNS = 4;

  private static readonly CELL = { width: 256, height: 128, tiles: 2 };
  private static readonly RIM = {
    height: 0.08,
    top: '#e4e9f0',
    bottom: '#8b94a3',
    line: 'rgba(0, 0, 0, 0.45)',
  };
  private static readonly STRIPE = { top: 0.6, bottom: 0.08, width: 0.22, alpha: 0.35 };
  private static readonly EMBLEM = { y: 0.44, size: 0.44, line: 4.5 };
  private static readonly NAME = { y: 0.79, size: 12, weight: 800, fill: 0.9 };
  private static readonly LID = {
    size: 64,
    center: '#eef1f5',
    edge: '#8e97a5',
    rings: [
      { radius: 0.47, width: 3, color: 'rgba(40, 46, 56, 0.55)' },
      { radius: 0.38, width: 1.5, color: 'rgba(40, 46, 56, 0.35)' },
    ],
    tab: { x: 0.5, y: 0.4, width: 0.16, height: 0.26, color: '#c5ccd6', hole: 0.05 },
    opening: { x: 0.5, y: 0.66, width: 0.2, height: 0.1, color: '#3a404a' },
  };

  /**
   * Crea el set de etiquetas.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Filas que ocupa el atlas para una cantidad de sabores.
   *
   * @param count Cantidad de sabores.
   * @returns Filas de la cuadrícula.
   */
  public static rows(count: number): number {
    return Math.max(Math.ceil(count / CanLabelArt.COLUMNS), 1);
  }

  /**
   * Atlas de etiquetas: celdas de izquierda a derecha y de arriba abajo, en el orden del catálogo.
   *
   * @param flavors Sabores a dibujar.
   * @returns Textura del atlas.
   */
  public atlas(flavors: readonly CanFlavor[]): Texture {
    const { width, height } = CanLabelArt.CELL;
    const columns = CanLabelArt.COLUMNS;
    return this.textures.paint(width * columns, height * CanLabelArt.rows(flavors.length), (context) => {
      flavors.forEach((flavor, index) => {
        context.save();
        context.translate((index % columns) * width, Math.floor(index / columns) * height);
        CanLabelArt.cell(context, flavor);
        context.restore();
      });
    });
  }

  /**
   * Tapa de aluminio vista desde arriba: degradado radial, anillos estampados y anilla.
   *
   * @returns Textura de la tapa.
   */
  public lid(): Texture {
    const { size, center, edge, rings } = CanLabelArt.LID;
    return this.textures.paint(size, size, (context) => {
      const half = size / 2;
      const gradient = context.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, center);
      gradient.addColorStop(1, edge);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      rings.forEach(({ radius, width, color }) => {
        context.strokeStyle = color;
        context.lineWidth = width;
        context.beginPath();
        context.arc(half, half, size * radius, 0, Math.PI * 2);
        context.stroke();
      });
      CanLabelArt.tab(context);
    });
  }

  /**
   * Una celda del atlas: fondo en degradado, el diseño repetido y los bordes metálicos.
   *
   * @param context Contexto 2D ya trasladado a la celda.
   * @param flavor Sabor.
   */
  private static cell(context: CanvasRenderingContext2D, flavor: CanFlavor): void {
    const { width, height, tiles } = CanLabelArt.CELL;
    const body = context.createLinearGradient(0, 0, 0, height);
    body.addColorStop(0, flavor.base);
    body.addColorStop(1, flavor.shade);
    context.fillStyle = body;
    context.fillRect(0, 0, width, height);
    const tile = width / tiles;
    for (let index = 0; index < tiles; index += 1) {
      CanLabelArt.tile(context, flavor, index * tile, tile);
    }
    CanLabelArt.rims(context);
  }

  /**
   * Un diseño de la etiqueta: franja diagonal, emblema y nombre.
   *
   * @param context Contexto 2D.
   * @param flavor Sabor.
   * @param left Borde izquierdo del diseño.
   * @param size Ancho del diseño.
   */
  private static tile(
    context: CanvasRenderingContext2D,
    flavor: CanFlavor,
    left: number,
    size: number,
  ): void {
    const { y, size: emblem, line } = CanLabelArt.EMBLEM;
    CanLabelArt.stripe(context, flavor, left, size);
    const x = left + size / 2;
    context.strokeStyle = flavor.ink;
    context.fillStyle = flavor.ink;
    context.lineWidth = line;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    flavor.emblem.draw(context, { x, y: CanLabelArt.CELL.height * y, size: size * emblem }, flavor);
    CanLabelArt.name(context, flavor, x, size);
  }

  /**
   * Nombre de la tecnología bajo el emblema, achicado si no cabe en el diseño.
   *
   * @param context Contexto 2D.
   * @param flavor Sabor.
   * @param x Centro horizontal del diseño.
   * @param size Ancho del diseño.
   */
  private static name(context: CanvasRenderingContext2D, flavor: CanFlavor, x: number, size: number): void {
    const { y, size: fontSize, weight, fill } = CanLabelArt.NAME;
    const text = flavor.name.toUpperCase();
    const font = (pixels: number): string =>
      `${String(weight)} ${String(pixels)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.font = font(fontSize);
    const width = context.measureText(text).width;
    if (width > size * fill) {
      context.font = font((fontSize * size * fill) / width);
    }
    context.fillStyle = flavor.ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, x, CanLabelArt.CELL.height * y);
  }

  /**
   * Franja diagonal translúcida con el color de acento.
   *
   * @param context Contexto 2D.
   * @param flavor Sabor.
   * @param left Borde izquierdo del diseño.
   * @param size Ancho del diseño.
   */
  private static stripe(
    context: CanvasRenderingContext2D,
    flavor: CanFlavor,
    left: number,
    size: number,
  ): void {
    const { height } = CanLabelArt.CELL;
    const { top, bottom, width, alpha } = CanLabelArt.STRIPE;
    context.globalAlpha = alpha;
    context.fillStyle = flavor.accent;
    context.beginPath();
    context.moveTo(left + size * top, 0);
    context.lineTo(left + size * (top + width), 0);
    context.lineTo(left + size * (bottom + width), height);
    context.lineTo(left + size * bottom, height);
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
  }

  /**
   * Bordes metálicos arriba y abajo de la etiqueta, con una línea oscura que los separa del cuerpo.
   *
   * @param context Contexto 2D.
   */
  private static rims(context: CanvasRenderingContext2D): void {
    const { width, height } = CanLabelArt.CELL;
    const { height: rim, top, bottom, line } = CanLabelArt.RIM;
    const size = height * rim;
    [0, height - size].forEach((y) => {
      const gradient = context.createLinearGradient(0, y, 0, y + size);
      gradient.addColorStop(0, top);
      gradient.addColorStop(1, bottom);
      context.fillStyle = gradient;
      context.fillRect(0, y, width, size);
    });
    context.fillStyle = line;
    context.fillRect(0, size, width, 1);
    context.fillRect(0, height - size - 1, width, 1);
  }

  /**
   * Anilla y abertura de la tapa.
   *
   * @param context Contexto 2D.
   */
  private static tab(context: CanvasRenderingContext2D): void {
    const { size, tab, opening } = CanLabelArt.LID;
    CanLabelArt.oval(context, opening, opening.color);
    CanLabelArt.oval(context, tab, tab.color);
    context.fillStyle = opening.color;
    context.beginPath();
    context.arc(size * tab.x, size * tab.y, size * tab.hole, 0, Math.PI * 2);
    context.fill();
  }

  /**
   * Óvalo relleno sobre la tapa, con medidas relativas a su tamaño.
   *
   * @param context Contexto 2D.
   * @param oval Centro y diámetros relativos.
   * @param oval.x Centro horizontal.
   * @param oval.y Centro vertical.
   * @param oval.width Diámetro horizontal.
   * @param oval.height Diámetro vertical.
   * @param color Color de relleno.
   */
  private static oval(
    context: CanvasRenderingContext2D,
    oval: { x: number; y: number; width: number; height: number },
    color: string,
  ): void {
    const { size } = CanLabelArt.LID;
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(
      size * oval.x,
      size * oval.y,
      (size * oval.width) / 2,
      (size * oval.height) / 2,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
}
