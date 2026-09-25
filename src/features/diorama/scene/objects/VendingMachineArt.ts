import type { Texture } from 'three';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Gráficas de la máquina expendedora dibujadas en canvas: letrero, fondo de la vitrina, reflejo del vidrio
 * y tira de precios con los botones "frío/caliente".
 */
export class VendingMachineArt {
  private static readonly HEADER = {
    width: 440,
    height: 100,
    top: '#070d24',
    bottom: '#02040c',
    title: {
      text: 'TECNOLOGÍAS',
      core: '#f2feff',
      size: 44,
      y: 0.42,
      halos: [
        { width: 14, color: 'rgba(94, 231, 255, 0.18)' },
        { width: 7, color: 'rgba(94, 231, 255, 0.55)' },
        { width: 3, color: 'rgba(160, 244, 255, 0.95)' },
      ],
    },
    subtitle: { text: 'つめた～い · あったか～い', color: '#ff5fa8', size: 17, y: 0.83 },
  };
  private static readonly BACK = { width: 64, height: 128, top: '#9fc8ff', bottom: '#1b2a5c' };
  private static readonly GLASS = {
    width: 64,
    height: 128,
    streaks: [
      { from: 0.08, width: 0.1, alpha: 0.045 },
      { from: 0.24, width: 0.035, alpha: 0.03 },
    ],
    slant: 0.35,
  };
  private static readonly STRIP = {
    width: 430,
    height: 28,
    font: 14,
    price: { x: 0.1, color: '#6dffb3' },
    button: { x: 0.62, y: 0.25, width: 0.28, height: 0.5, cold: '#3fa9ff', hot: '#ff4d5e' },
  };
  private static readonly PRICES = ['¥120', '¥150', '¥130', '¥160', '¥110'];

  /**
   * Crea el set de gráficas.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Letrero: franja oscura con el título en cian y el subtítulo en japonés.
   *
   * @returns Textura del letrero.
   */
  public header(): Texture {
    const { width, height, top, bottom, subtitle } = VendingMachineArt.HEADER;
    return this.textures.paint(width, height, (context) => {
      VendingMachineArt.gradient(context, { width, height, top, bottom });
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      VendingMachineArt.neonTitle(context);
      context.fillStyle = subtitle.color;
      context.font = `700 ${String(subtitle.size)}px ${CanvasTextureFactory.JAPANESE_FONT}`;
      context.fillText(subtitle.text, width / 2, height * subtitle.y);
    });
  }

  /**
   * Fondo de la vitrina: blanco azulado con degradado vertical.
   *
   * @returns Textura del fondo.
   */
  public back(): Texture {
    const { width, height, top, bottom } = VendingMachineArt.BACK;
    return this.textures.paint(width, height, (context) => {
      VendingMachineArt.gradient(context, { width, height, top, bottom });
    });
  }

  /**
   * Reflejo falso del vidrio: dos franjas diagonales tenues sobre fondo transparente. Se usa en lugar de un
   * material especular para que la luz de la máquina no deje un destello blanco sobre la vitrina.
   *
   * @returns Textura del reflejo (canal alfa).
   */
  public glass(): Texture {
    const { width, height, streaks, slant } = VendingMachineArt.GLASS;
    return this.textures.paint(width, height, (context) => {
      streaks.forEach(({ from, width: size, alpha }) => {
        context.fillStyle = `rgba(255, 255, 255, ${String(alpha)})`;
        context.beginPath();
        context.moveTo(width * from, height);
        context.lineTo(width * (from + size), height);
        context.lineTo(width * (from + size + slant), 0);
        context.lineTo(width * (from + slant), 0);
        context.closePath();
        context.fill();
      });
    });
  }

  /**
   * Tira de precios: precio en dígitos verdes y botón azul (frío) o rojo (caliente) por lata.
   *
   * @returns Textura de la tira.
   */
  public strip(): Texture {
    const { width, height, font } = VendingMachineArt.STRIP;
    const slot = width / VendingMachineArt.PRICES.length;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = '#050a14';
      context.fillRect(0, 0, width, height);
      context.textBaseline = 'middle';
      context.font = `700 ${String(font)}px ${CanvasTextureFactory.MONO_FONT}`;
      VendingMachineArt.PRICES.forEach((price, index) => {
        VendingMachineArt.priceSlot(context, price, index, slot);
      });
    });
  }

  /**
   * Título del letrero dibujado como un tubo de neón: halos de trazo cada vez más finos y núcleo casi blanco.
   *
   * @param context Contexto 2D.
   */
  private static neonTitle(context: CanvasRenderingContext2D): void {
    const { width, height, title } = VendingMachineArt.HEADER;
    const x = width / 2;
    const y = height * title.y;
    context.font = `800 ${String(title.size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.lineJoin = 'round';
    title.halos.forEach((halo) => {
      context.strokeStyle = halo.color;
      context.lineWidth = halo.width;
      context.strokeText(title.text, x, y);
    });
    context.fillStyle = title.core;
    context.fillText(title.text, x, y);
  }

  /**
   * Un espacio de la tira: precio y botón de selección.
   *
   * @param context Contexto 2D.
   * @param price Precio.
   * @param index Posición del espacio.
   * @param slot Ancho de cada espacio.
   */
  private static priceSlot(
    context: CanvasRenderingContext2D,
    price: string,
    index: number,
    slot: number,
  ): void {
    const { height, price: text, button } = VendingMachineArt.STRIP;
    const left = index * slot;
    context.fillStyle = text.color;
    context.fillText(price, left + slot * text.x, height / 2);
    context.fillStyle = index % 2 === 0 ? button.cold : button.hot;
    context.fillRect(left + slot * button.x, height * button.y, slot * button.width, height * button.height);
  }

  /**
   * Rellena el canvas con un degradado vertical.
   *
   * @param context Contexto 2D.
   * @param fill Tamaño y colores.
   * @param fill.width Ancho.
   * @param fill.height Alto.
   * @param fill.top Color de arriba.
   * @param fill.bottom Color de abajo.
   */
  private static gradient(
    context: CanvasRenderingContext2D,
    fill: { width: number; height: number; top: string; bottom: string },
  ): void {
    const gradient = context.createLinearGradient(0, 0, 0, fill.height);
    gradient.addColorStop(0, fill.top);
    gradient.addColorStop(1, fill.bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, fill.width, fill.height);
  }
}
