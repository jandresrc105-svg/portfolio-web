import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';

/**
 * Fábrica de texturas dibujadas en canvas (patrón Factory): letreros, telas, ruido y partículas.
 * Evita depender de imágenes externas: todo el diorama es procedural.
 */
export class CanvasTextureFactory {
  public static readonly JAPANESE_FONT = "'Noto Sans JP', 'Yu Gothic', 'Hiragino Sans', 'Meiryo', sans-serif";
  public static readonly MONO_FONT = "'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace";
  public static readonly SANS_FONT = "'Inter', 'Segoe UI', system-ui, sans-serif";

  private static readonly NOISE_SIZE = 256;
  private static readonly NOISE_BLOBS = 90;
  private static readonly DOT_SIZE = 64;
  private static readonly DOT_FALLOFF = { stop: 0.4, color: 'rgba(255,255,255,0.45)' };
  private static readonly BLOB = { minRadius: 0.02, maxRadius: 0.14, minAlpha: 0.4, maxAlpha: 0.9 };
  private static readonly WOOD = { width: 256, height: 64, streaks: 70, knots: 3, base: '#ffffff' };
  private static readonly CORRUGATED = { size: 128, ridges: 16, streaks: 18, reach: 4 };
  private static readonly RUST = { alpha: { min: 0.1, max: 0.3 }, width: { min: 1, max: 3 } };
  private static readonly ASPHALT = { size: 256, specks: 2600, cracks: 7, crackSteps: 9, crackJump: 12 };
  private static readonly SPECK = { min: 60, max: 190, blue: 6, size: 1.5, crackWidth: 1.2 };
  private static readonly GRAIN = { wave: 4, alpha: { min: 0.08, max: 0.3 }, width: { min: 0.5, max: 2 } };
  private static readonly KNOT = { rings: 3, radiusX: 4, radiusY: 1.6 };
  private static readonly SHADOW = { size: 64, core: 'rgba(0,0,0,0.85)', stop: 0.35 };

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
   * Veta de madera en escala de grises repetible (el color lo pone el material).
   *
   * @returns Textura repetible.
   */
  public woodGrain(): CanvasTexture {
    const { width, height, streaks, knots, base } = CanvasTextureFactory.WOOD;
    const texture = this.paint(width, height, (context) => {
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);
      for (let streak = 0; streak < streaks; streak += 1) {
        this.grainStreak(context, width, height);
      }
      for (let knot = 0; knot < knots; knot += 1) {
        this.knot(context, width, height);
      }
    });
    return CanvasTextureFactory.repeat(texture);
  }

  /**
   * Chapa corrugada con surcos claros/oscuros y chorreones de óxido.
   *
   * @returns Textura repetible del techo.
   */
  public corrugated(): CanvasTexture {
    const { size, streaks } = CanvasTextureFactory.CORRUGATED;
    const texture = this.paint(size, size, (context) => {
      CanvasTextureFactory.ridges(context);
      for (let streak = 0; streak < streaks; streak += 1) {
        this.rust(context);
      }
    });
    return CanvasTextureFactory.repeat(texture);
  }

  /**
   * Asfalto: grano de piedritas claras y oscuras con grietas finas (color, en sRGB).
   *
   * @returns Textura repetible.
   */
  public asphalt(): CanvasTexture {
    const { size, specks, cracks } = CanvasTextureFactory.ASPHALT;
    const texture = this.paint(size, size, (context) => {
      context.fillStyle = '#7a7a82';
      context.fillRect(0, 0, size, size);
      for (let speck = 0; speck < specks; speck += 1) {
        this.speck(context, size);
      }
      context.strokeStyle = 'rgba(20, 20, 26, 0.7)';
      context.lineWidth = CanvasTextureFactory.SPECK.crackWidth;
      for (let crack = 0; crack < cracks; crack += 1) {
        this.crack(context, size);
      }
    });
    return CanvasTextureFactory.repeat(texture);
  }

  /**
   * Sombra de contacto: mancha negra radial difuminada.
   *
   * @returns Textura con transparencia.
   */
  public shadowBlob(): CanvasTexture {
    const { size, core, stop } = CanvasTextureFactory.SHADOW;
    return this.paint(size, size, (context) => {
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, core);
      gradient.addColorStop(stop, core);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
    });
  }

  /**
   * Línea de veta ondulada a lo largo de la tabla.
   *
   * @param context Contexto de dibujo.
   * @param width Ancho.
   * @param height Alto.
   */
  private grainStreak(context: CanvasRenderingContext2D, width: number, height: number): void {
    const { wave: maxWave, alpha, width: line } = CanvasTextureFactory.GRAIN;
    const y = this.random.range(0, height);
    const wave = this.random.range(1, maxWave);
    context.strokeStyle = `rgba(60, 35, 20, ${String(this.random.range(alpha.min, alpha.max))})`;
    context.lineWidth = this.random.range(line.min, line.max);
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(width / 3, y - wave, (width * 2) / 3, y + wave, width, y);
    context.stroke();
  }

  /**
   * Nudo de la madera: anillos concéntricos oscuros.
   *
   * @param context Contexto de dibujo.
   * @param width Ancho.
   * @param height Alto.
   */
  private knot(context: CanvasRenderingContext2D, width: number, height: number): void {
    const x = this.random.range(0, width);
    const y = this.random.range(0, height);
    context.strokeStyle = 'rgba(60, 35, 20, 0.35)';
    context.lineWidth = 1;
    const { rings, radiusX, radiusY } = CanvasTextureFactory.KNOT;
    for (let ring = 1; ring <= rings; ring += 1) {
      context.beginPath();
      context.ellipse(x, y, ring * radiusX, ring * radiusY, 0, 0, Math.PI * 2);
      context.stroke();
    }
  }

  /**
   * Piedrita del asfalto, clara u oscura.
   *
   * @param context Contexto de dibujo.
   * @param size Tamaño del canvas.
   */
  private speck(context: CanvasRenderingContext2D, size: number): void {
    const { min, max, blue, size: speck } = CanvasTextureFactory.SPECK;
    const shade = Math.round(this.random.range(min, max));
    context.fillStyle = `rgb(${String(shade)}, ${String(shade)}, ${String(shade + blue)})`;
    context.fillRect(this.random.range(0, size), this.random.range(0, size), speck, speck);
  }

  /**
   * Chorreón de óxido que baja desde el borde del techo.
   *
   * @param context Contexto de dibujo.
   */
  private rust(context: CanvasRenderingContext2D): void {
    const { size, reach } = CanvasTextureFactory.CORRUGATED;
    const { alpha, width } = CanvasTextureFactory.RUST;
    context.fillStyle = `rgba(120, 58, 30, ${String(this.random.range(alpha.min, alpha.max))})`;
    context.fillRect(
      this.random.range(0, size),
      0,
      this.random.range(width.min, width.max),
      this.random.range(size / reach, size),
    );
  }

  /**
   * Grieta quebrada que avanza en zigzag.
   *
   * @param context Contexto de dibujo.
   * @param size Tamaño del canvas.
   */
  private crack(context: CanvasRenderingContext2D, size: number): void {
    let x = this.random.range(0, size);
    let y = this.random.range(0, size);
    context.beginPath();
    context.moveTo(x, y);
    const { crackSteps, crackJump } = CanvasTextureFactory.ASPHALT;
    for (let step = 0; step < crackSteps; step += 1) {
      x += this.random.range(-crackJump, crackJump);
      y += this.random.range(-crackJump, crackJump);
      context.lineTo(x, y);
    }
    context.stroke();
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
   * Surcos de la chapa: franjas con degradado claro en la cresta y oscuro en el valle.
   *
   * @param context Contexto de dibujo.
   */
  private static ridges(context: CanvasRenderingContext2D): void {
    const { size, ridges } = CanvasTextureFactory.CORRUGATED;
    const gradient = context.createLinearGradient(0, 0, size / ridges, 0);
    gradient.addColorStop(0, '#5a5f6c');
    gradient.addColorStop(0.5, '#c9ccd6');
    gradient.addColorStop(1, '#5a5f6c');
    for (let ridge = 0; ridge < ridges; ridge += 1) {
      context.save();
      context.translate((size / ridges) * ridge, 0);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size / ridges, size);
      context.restore();
    }
  }

  /**
   * Configura una textura para repetirse en ambos ejes.
   *
   * @param texture Textura.
   * @returns La misma textura.
   */
  private static repeat(texture: CanvasTexture): CanvasTexture {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    return texture;
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
