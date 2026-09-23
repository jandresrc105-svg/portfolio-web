import type { Vector2Like } from 'three';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { CanFlavor } from './CanFlavor';
import type { EmblemBox } from './EmblemBox';

/**
 * Emblema dibujado en la etiqueta de una lata (patrón Strategy: una subclase por dibujo).
 * Al llamarse, el trazo y el relleno del contexto ya están en el color de tinta del sabor.
 */
export abstract class CanEmblem {
  private static readonly GLYPH = { height: 0.62, fill: 0.9, weight: 800 };

  /**
   * Dibuja el emblema.
   *
   * @param context Contexto 2D de la etiqueta.
   * @param box Zona del emblema.
   * @param flavor Sabor de la lata (colores y siglas).
   */
  public abstract draw(context: CanvasRenderingContext2D, box: EmblemBox, flavor: CanFlavor): void;

  /**
   * Abre un trazo cerrado que une los puntos dados (sin pintarlo).
   *
   * @param context Contexto 2D.
   * @param points Vértices en orden.
   */
  protected polygon(context: CanvasRenderingContext2D, points: readonly Vector2Like[]): void {
    context.beginPath();
    points.forEach((point) => {
      context.lineTo(point.x, point.y);
    });
    context.closePath();
  }

  /**
   * Siglas centradas que se achican hasta caber en el emblema.
   *
   * @param context Contexto 2D.
   * @param text Siglas.
   * @param box Zona del emblema.
   * @param scale Fracción del emblema que pueden ocupar.
   */
  protected glyph(context: CanvasRenderingContext2D, text: string, box: EmblemBox, scale = 1): void {
    const { height, fill, weight } = CanEmblem.GLYPH;
    const room = box.size * scale;
    const font = (size: number): string =>
      `${String(weight)} ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.font = font(room * height);
    const width = context.measureText(text).width;
    if (width > room * fill) {
      context.font = font((room * height * room * fill) / width);
    }
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, box.x, box.y);
  }

  /**
   * Vértices de un polígono regular.
   *
   * @param box Zona del emblema.
   * @param sides Cantidad de lados.
   * @param radius Radio relativo al lado del emblema.
   * @param turn Giro inicial en radianes.
   * @returns Vértices.
   */
  protected regular(box: EmblemBox, sides: number, radius: number, turn: number): Vector2Like[] {
    return Array.from({ length: sides }, (_, index) => {
      const angle = turn + (index * Math.PI * 2) / sides;
      return {
        x: box.x + Math.cos(angle) * box.size * radius,
        y: box.y + Math.sin(angle) * box.size * radius,
      };
    });
  }
}
