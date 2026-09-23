import type { CanvasTexture } from 'three';
import type { BoardArt } from '../../models/BoardArt';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pinta la cara superior de una placa de circuito: máscara antisoldante verde con un leve degradado,
 * pistas de cobre que se transparentan bajo la máscara, pads dorados (ENIG), agujeros metalizados y
 * serigrafía blanca.
 */
export class CircuitBoardArt {
  private static readonly RESOLUTION = 8000;
  private static readonly MASK = { light: '#12603b', dark: '#0a4028' };
  private static readonly COPPER = 'rgba(96, 196, 120, 0.42)';
  private static readonly GOLD = '#d9b45e';
  private static readonly DRILL = '#07090a';
  private static readonly SILK = '#eef2f0';
  private static readonly SILK_LINE = 0.00018;
  private static readonly DRILL_RATIO = 0.55;
  private static readonly WEIGHT = 700;

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Pinta la placa.
   *
   * @param width Ancho de la placa en metros.
   * @param depth Profundidad de la placa en metros.
   * @param art Arte de la placa.
   * @returns Textura de la cara superior.
   */
  public paint(width: number, depth: number, art: BoardArt): CanvasTexture {
    const scale = CircuitBoardArt.RESOLUTION;
    const pixels = { width: Math.round(width * scale), height: Math.round(depth * scale) };
    const place = (x: number, z: number): { x: number; y: number } => ({
      x: (x + width / 2) * scale,
      y: (z + depth / 2) * scale,
    });
    const texture = this.textures.paint(
      pixels.width,
      pixels.height,
      (context) => {
        CircuitBoardArt.mask(context, pixels.width, pixels.height);
        CircuitBoardArt.traces(context, art, place, scale);
        CircuitBoardArt.pads(context, art, place, scale);
        CircuitBoardArt.silkscreen(context, art, place, scale);
      },
      1,
    );
    return texture;
  }

  /**
   * Máscara antisoldante con un degradado diagonal suave.
   *
   * @param context Contexto 2D.
   * @param width Ancho en píxeles.
   * @param height Alto en píxeles.
   */
  private static mask(context: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, CircuitBoardArt.MASK.light);
    gradient.addColorStop(1, CircuitBoardArt.MASK.dark);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  /**
   * Pistas de cobre bajo la máscara.
   *
   * @param context Contexto 2D.
   * @param art Arte de la placa.
   * @param place Convierte metros de la placa a píxeles.
   * @param scale Píxeles por metro.
   */
  private static traces(
    context: CanvasRenderingContext2D,
    art: BoardArt,
    place: (x: number, z: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.strokeStyle = CircuitBoardArt.COPPER;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    art.traces.forEach(({ points, width }) => {
      context.lineWidth = width * scale;
      context.beginPath();
      points.forEach(({ x, z }) => {
        const point = place(x, z);
        context.lineTo(point.x, point.y);
      });
      context.stroke();
    });
  }

  /**
   * Pads dorados y agujeros de montaje.
   *
   * @param context Contexto 2D.
   * @param art Arte de la placa.
   * @param place Convierte metros de la placa a píxeles.
   * @param scale Píxeles por metro.
   */
  private static pads(
    context: CanvasRenderingContext2D,
    art: BoardArt,
    place: (x: number, z: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.fillStyle = CircuitBoardArt.GOLD;
    art.pads.forEach(({ x, z, width, depth }) => {
      const corner = place(x - width / 2, z - depth / 2);
      context.fillRect(corner.x, corner.y, width * scale, depth * scale);
    });
    CircuitBoardArt.holes(context, art, place, scale);
  }

  /**
   * Agujeros de montaje metalizados: anillo dorado y taladro.
   *
   * @param context Contexto 2D.
   * @param art Arte de la placa.
   * @param place Convierte metros de la placa a píxeles.
   * @param scale Píxeles por metro.
   */
  private static holes(
    context: CanvasRenderingContext2D,
    art: BoardArt,
    place: (x: number, z: number) => { x: number; y: number },
    scale: number,
  ): void {
    art.holes.forEach(({ x, z, radius }) => {
      const center = place(x, z);
      CircuitBoardArt.disc(context, center, radius * scale, CircuitBoardArt.GOLD);
      CircuitBoardArt.disc(
        context,
        center,
        radius * scale * CircuitBoardArt.DRILL_RATIO,
        CircuitBoardArt.DRILL,
      );
    });
  }

  /**
   * Contornos y textos de serigrafía.
   *
   * @param context Contexto 2D.
   * @param art Arte de la placa.
   * @param place Convierte metros de la placa a píxeles.
   * @param scale Píxeles por metro.
   */
  private static silkscreen(
    context: CanvasRenderingContext2D,
    art: BoardArt,
    place: (x: number, z: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.strokeStyle = CircuitBoardArt.SILK;
    context.fillStyle = CircuitBoardArt.SILK;
    context.lineWidth = CircuitBoardArt.SILK_LINE * scale;
    art.outlines.forEach(({ x, z, width, depth }) => {
      const corner = place(x - width / 2, z - depth / 2);
      context.strokeRect(corner.x, corner.y, width * scale, depth * scale);
    });
    CircuitBoardArt.labels(context, art, place, scale);
  }

  /**
   * Textos de serigrafía.
   *
   * @param context Contexto 2D.
   * @param art Arte de la placa.
   * @param place Convierte metros de la placa a píxeles.
   * @param scale Píxeles por metro.
   */
  private static labels(
    context: CanvasRenderingContext2D,
    art: BoardArt,
    place: (x: number, z: number) => { x: number; y: number },
    scale: number,
  ): void {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    art.labels.forEach(({ text, x, z, size }) => {
      const point = place(x, z);
      context.font = `${String(CircuitBoardArt.WEIGHT)} ${String(size * scale)}px ${CanvasTextureFactory.SANS_FONT}`;
      context.fillText(text, point.x, point.y);
    });
  }

  /**
   * Círculo relleno.
   *
   * @param context Contexto 2D.
   * @param center Centro en píxeles.
   * @param center.x Horizontal.
   * @param center.y Vertical.
   * @param radius Radio en píxeles.
   * @param color Color.
   */
  private static disc(
    context: CanvasRenderingContext2D,
    center: { x: number; y: number },
    radius: number,
    color: string,
  ): void {
    context.fillStyle = color;
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.fill();
  }
}
