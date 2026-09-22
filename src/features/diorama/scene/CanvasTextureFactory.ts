import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';

/**
 * Fábrica de texturas dibujadas en canvas (patrón Factory): letreros, telas, ruido y partículas.
 * Evita depender de imágenes externas: todo el diorama es procedural.
 */
export class CanvasTextureFactory {
  public static readonly JAPANESE_FONT = "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', 'Meiryo', sans-serif";
  public static readonly MONO_FONT = "'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace";

  private static readonly NOISE_SIZE = 256;
  private static readonly NOISE_BLOBS = 90;
  private static readonly DOT_SIZE = 64;
  private static readonly DOT_FALLOFF = { stop: 0.4, color: 'rgba(255,255,255,0.45)' };
  private static readonly BLOB = { minRadius: 0.02, maxRadius: 0.14, minAlpha: 0.4, maxAlpha: 0.9 };

  /**
   * Crea la fábrica.
   *
   * @param random Generador determinista para el ruido.
   * @param anisotropy Filtrado anisotrópico máximo de la GPU (nitidez en ángulos rasantes).
   * @param supersample Factor de resolución real del canvas respecto a las medidas lógicas de dibujo.
   */
  public constructor(
    private readonly random: SeededRandom,
    private readonly anisotropy: number,
    private readonly supersample: number,
  ) {}

  /**
   * Crea una textura a partir de una función de dibujo. Las medidas son lógicas: el canvas real
   * es `supersample` veces más grande y se escala solo, así el código de dibujo no cambia.
   *
   * @param width Ancho lógico del canvas.
   * @param height Alto lógico del canvas.
   * @param paint Función que dibuja sobre el contexto.
   * @param scale Resolución del canvas; las texturas que se redibujan cada frame deben usar 1.
   * @returns Textura en espacio de color sRGB.
   */
  public paint(
    width: number,
    height: number,
    paint: (context: CanvasRenderingContext2D) => void,
    scale = this.supersample,
  ): CanvasTexture {
    const context = CanvasTextureFactory.context(width * scale, height * scale);
    context.scale(scale, scale);
    paint(context);
    const texture = new CanvasTexture(context.canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = this.anisotropy;
    return texture;
  }

  /**
   * Mapa de rugosidad con manchas: zonas brillantes simulan asfalto mojado.
   *
   * @returns Textura repetible en escala de grises (datos, no color).
   */
  public wetness(): CanvasTexture {
    const size = CanvasTextureFactory.NOISE_SIZE;
    const texture = this.paint(size, size, (context) => {
      context.fillStyle = '#b8b8b8';
      context.fillRect(0, 0, size, size);
      for (let blob = 0; blob < CanvasTextureFactory.NOISE_BLOBS; blob += 1) {
        this.blob(context, size);
      }
    });
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
  }

  /**
   * Punto circular difuminado para partículas (vapor, luces lejanas).
   *
   * @returns Textura de punto suave.
   */
  public softDot(): CanvasTexture {
    const size = CanvasTextureFactory.DOT_SIZE;
    return this.paint(size, size, (context) => {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(CanvasTextureFactory.DOT_FALLOFF.stop, CanvasTextureFactory.DOT_FALLOFF.color);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    });
  }

  /**
   * Dibuja una mancha oscura (baja rugosidad = charco brillante).
   *
   * @param context Contexto de dibujo.
   * @param size Tamaño del canvas.
   */
  private blob(context: CanvasRenderingContext2D, size: number): void {
    const x = this.random.range(0, size);
    const y = this.random.range(0, size);
    const { minRadius, maxRadius, minAlpha, maxAlpha } = CanvasTextureFactory.BLOB;
    const radius = this.random.range(size * minRadius, size * maxRadius);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(20,20,20,${String(this.random.range(minAlpha, maxAlpha))})`);
    gradient.addColorStop(1, 'rgba(20,20,20,0)');
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  /**
   * Crea un contexto 2D sobre un canvas nuevo.
   *
   * @param width Ancho.
   * @param height Alto.
   * @returns Contexto 2D.
   * @throws {Error} Si el navegador no soporta canvas 2D.
   */
  private static context(width: number, height: number): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D no disponible');
    }
    return context;
  }
}
