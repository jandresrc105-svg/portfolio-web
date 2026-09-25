import type { Texture } from 'three';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Dibujos de las luces del semáforo peatonal: el muñeco quieto (pare) y el muñeco caminando (siga), en blanco
 * sobre negro. El color lo pone el material, así la misma textura sirve encendida y apagada.
 */
export class CrossingSignalArt {
  private static readonly SIZE = 128;
  private static readonly HEAD = { x: 64, y: 26, radius: 12 };
  private static readonly LINE = 13;
  private static readonly STANDING = [
    { from: { x: 64, y: 42 }, to: { x: 64, y: 82 } },
    { from: { x: 64, y: 48 }, to: { x: 46, y: 78 } },
    { from: { x: 64, y: 48 }, to: { x: 82, y: 78 } },
    { from: { x: 58, y: 82 }, to: { x: 56, y: 118 } },
    { from: { x: 70, y: 82 }, to: { x: 72, y: 118 } },
  ];
  private static readonly WALKING = [
    { from: { x: 62, y: 42 }, to: { x: 58, y: 80 } },
    { from: { x: 62, y: 48 }, to: { x: 40, y: 70 } },
    { from: { x: 62, y: 48 }, to: { x: 84, y: 66 } },
    { from: { x: 58, y: 80 }, to: { x: 38, y: 116 } },
    { from: { x: 58, y: 80 }, to: { x: 84, y: 114 } },
  ];

  /**
   * Prepara los dibujos.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Muñeco quieto, de brazos abajo.
   *
   * @returns Textura.
   */
  public standing(): Texture {
    return this.figure(CrossingSignalArt.STANDING);
  }

  /**
   * Muñeco caminando, a media zancada.
   *
   * @returns Textura.
   */
  public walking(): Texture {
    return this.figure(CrossingSignalArt.WALKING);
  }

  /**
   * Dibuja una figura de palitos con cabeza redonda.
   *
   * @param limbs Segmentos del cuerpo, brazos y piernas.
   * @returns Textura.
   */
  private figure(
    limbs: readonly { from: { x: number; y: number }; to: { x: number; y: number } }[],
  ): Texture {
    const size = CrossingSignalArt.SIZE;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = '#000000';
      context.fillRect(0, 0, size, size);
      context.fillStyle = '#ffffff';
      context.strokeStyle = '#ffffff';
      context.lineWidth = CrossingSignalArt.LINE;
      context.lineCap = 'round';
      CrossingSignalArt.head(context);
      limbs.forEach(({ from, to }) => {
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        context.stroke();
      });
    });
  }

  /**
   * Cabeza redonda del muñeco.
   *
   * @param context Contexto 2D.
   */
  private static head(context: CanvasRenderingContext2D): void {
    const { x, y, radius } = CrossingSignalArt.HEAD;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}
