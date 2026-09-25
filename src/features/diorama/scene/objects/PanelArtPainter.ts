import type { CanvasTexture } from 'three';
import type { PanelArt } from '../../models/PanelArt';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pinta la serigrafía de un panel frontal de instrumento sobre un canvas: fondo de aluminio anodizado
 * oscuro con un cepillado sutil, textos, anillos de color y marcos de grupo.
 */
export class PanelArtPainter {
  private static readonly RESOLUTION = 2600;
  private static readonly BASE = { top: '#34383f', bottom: '#272a30' };
  private static readonly BRUSH = { lines: 180, color: 'rgba(255, 255, 255, 0.018)' };
  private static readonly STROKE = 1.6;
  private static readonly RING_WIDTH = 2.4;
  private static readonly CORNER = 4;

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Pinta un panel.
   *
   * @param width Ancho del panel en metros.
   * @param height Alto del panel en metros.
   * @param art Serigrafía.
   * @returns Textura del panel.
   */
  public paint(width: number, height: number, art: PanelArt): CanvasTexture {
    const scale = PanelArtPainter.RESOLUTION;
    const pixels = { width: Math.round(width * scale), height: Math.round(height * scale) };
    const place = (x: number, y: number): { x: number; y: number } => ({
      x: (x + width / 2) * scale,
      y: (height / 2 - y) * scale,
    });
    return this.textures.paint(pixels.width, pixels.height, (context) => {
      PanelArtPainter.background(context, pixels.width, pixels.height);
      PanelArtPainter.frames(context, art, place, scale);
      PanelArtPainter.rings(context, art, place, scale);
      PanelArtPainter.labels(context, art, place, scale);
    });
  }

  /**
   * Aluminio oscuro con un cepillado vertical muy suave.
   *
   * @param context Contexto 2D.
   * @param width Ancho en píxeles.
   * @param height Alto en píxeles.
   */
  private static background(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, PanelArtPainter.BASE.top);
    gradient.addColorStop(1, PanelArtPainter.BASE.bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    const { lines, color } = PanelArtPainter.BRUSH;
    context.fillStyle = color;
    for (let line = 0; line < lines; line += 1) {
      context.fillRect((width / lines) * line, 0, 1, height);
    }
  }

  /**
   * Marcos redondeados alrededor de cada grupo de controles.
   *
   * @param context Contexto 2D.
   * @param art Serigrafía.
   * @param place Convierte metros del panel a píxeles.
   * @param scale Píxeles por metro.
   */
  private static frames(
    context: CanvasRenderingContext2D,
    art: PanelArt,
    place: (x: number, y: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.lineWidth = PanelArtPainter.STROKE;
    art.frames.forEach(({ x, y, width, height, color }) => {
      const corner = place(x - width / 2, y + height / 2);
      context.strokeStyle = color;
      context.beginPath();
      context.roundRect(corner.x, corner.y, width * scale, height * scale, PanelArtPainter.CORNER);
      context.stroke();
    });
  }

  /**
   * Anillos de color.
   *
   * @param context Contexto 2D.
   * @param art Serigrafía.
   * @param place Convierte metros del panel a píxeles.
   * @param scale Píxeles por metro.
   */
  private static rings(
    context: CanvasRenderingContext2D,
    art: PanelArt,
    place: (x: number, y: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.lineWidth = PanelArtPainter.RING_WIDTH;
    art.rings.forEach(({ x, y, radius, color }) => {
      const center = place(x, y);
      context.strokeStyle = color;
      context.beginPath();
      context.arc(center.x, center.y, radius * scale, 0, Math.PI * 2);
      context.stroke();
    });
  }

  /**
   * Textos impresos.
   *
   * @param context Contexto 2D.
   * @param art Serigrafía.
   * @param place Convierte metros del panel a píxeles.
   * @param scale Píxeles por metro.
   */
  private static labels(
    context: CanvasRenderingContext2D,
    art: PanelArt,
    place: (x: number, y: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.textBaseline = 'middle';
    art.labels.forEach(({ text, x, y, size, color, weight, align }) => {
      const point = place(x, y);
      context.font = `${String(weight)} ${String(size * scale)}px ${CanvasTextureFactory.SANS_FONT}`;
      context.fillStyle = color;
      context.textAlign = align;
      context.fillText(text, point.x, point.y);
    });
  }
}
