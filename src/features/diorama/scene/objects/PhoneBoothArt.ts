import type { Texture } from 'three';
import type { PhoneDisplay } from '../../models/PhoneDisplay';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Gráficas de la cabina telefónica dibujadas en canvas: la franja luminosa "公衆電話" que corona la
 * cabina, la pantalla LCD del teléfono, los números de las teclas y la tarjeta de marcado rápido.
 */
export class PhoneBoothArt {
  private static readonly DETAIL = 3;
  private static readonly SIGN = {
    width: 256,
    height: 48,
    background: '#f4fbf6',
    stripe: { color: '#14a05a', height: 0.16 },
    title: { text: '公衆電話', color: '#0e6b3c', size: 24, y: 0.46 },
    subtitle: { text: 'TELEPHONE', color: '#14a05a', size: 9, y: 0.8, spacing: 3 },
  };
  private static readonly SCREEN = {
    width: 128,
    height: 48,
    background: '#9fe8a8',
    ink: '#0b3d1c',
    title: { size: 16, y: 0.36 },
    detail: { size: 10, y: 0.74 },
  };
  private static readonly KEYS = {
    columns: 3,
    cell: 32,
    background: '#e4ebe7',
    ink: '#16241c',
    size: 22,
    fallbackRows: 1,
  };
  private static readonly CARD = {
    width: 128,
    height: 168,
    paper: '#f7f3e3',
    band: { color: '#14a05a', height: 30 },
    title: { text: 'MARCADO RÁPIDO', color: '#ffffff', size: 11 },
    line: { top: 50, step: 34, size: 15, number: '#c0362c', label: '#1d2a22', indent: 14, gap: 18 },
    rule: { color: 'rgba(20, 60, 40, 0.25)', offset: 14 },
  };

  /**
   * Crea el set de gráficas.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Franja del techo: fondo blanco con bordes verdes y "公衆電話" con "TELEPHONE" debajo.
   *
   * @returns Textura de la franja.
   */
  public sign(): Texture {
    const { width, height, background, stripe, title, subtitle } = PhoneBoothArt.SIGN;
    return this.paint(width, height, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.fillStyle = stripe.color;
      context.fillRect(0, 0, width, height * stripe.height);
      context.fillRect(0, height * (1 - stripe.height), width, height * stripe.height);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = title.color;
      context.font = `700 ${String(title.size)}px ${CanvasTextureFactory.JAPANESE_FONT}`;
      context.fillText(title.text, width / 2, height * title.y);
      context.fillStyle = subtitle.color;
      context.font = `700 ${String(subtitle.size)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.letterSpacing = `${String(subtitle.spacing)}px`;
      context.fillText(subtitle.text, width / 2, height * subtitle.y);
    });
  }

  /**
   * Pantalla LCD verde del teléfono con el texto de su estado en tinta oscura.
   *
   * @param display Líneas de la pantalla.
   * @returns Textura de la pantalla.
   */
  public screen(display: PhoneDisplay): Texture {
    const { width, height, background, ink, title, detail } = PhoneBoothArt.SCREEN;
    return this.paint(width, height, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = ink;
      context.font = `700 ${String(title.size)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText(display.title, width / 2, height * title.y, width);
      context.font = `700 ${String(detail.size)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText(display.detail, width / 2, height * detail.y, width);
    });
  }

  /**
   * Atlas con el número de cada tecla, en una cuadrícula de 3 columnas en el orden del teclado.
   *
   * @param keys Texto de cada tecla, en orden de lectura.
   * @returns Textura del atlas.
   */
  public keys(keys: readonly string[]): Texture {
    const { columns, cell, background, ink, size } = PhoneBoothArt.KEYS;
    const rows = Math.ceil(keys.length / columns) || PhoneBoothArt.KEYS.fallbackRows;
    return this.paint(columns * cell, rows * cell, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, columns * cell, rows * cell);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = ink;
      context.font = `700 ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
      keys.forEach((key, index) => {
        const x = ((index % columns) + 1 / 2) * cell;
        const y = (Math.floor(index / columns) + 1 / 2) * cell;
        context.fillText(key, x, y);
      });
    });
  }

  /**
   * Tarjeta de marcado rápido pegada junto al teléfono: franja verde con el título y una línea por canal
   * ("1  GITHUB").
   *
   * @param labels Nombre de cada canal, en el orden de las teclas.
   * @returns Textura de la tarjeta.
   */
  public card(labels: readonly string[]): Texture {
    const { width, height, paper, band, title } = PhoneBoothArt.CARD;
    return this.paint(width, height, (context) => {
      context.fillStyle = paper;
      context.fillRect(0, 0, width, height);
      context.fillStyle = band.color;
      context.fillRect(0, 0, width, band.height);
      context.textBaseline = 'middle';
      context.textAlign = 'center';
      context.fillStyle = title.color;
      context.font = `700 ${String(title.size)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText(title.text, width / 2, band.height / 2, width);
      labels.forEach((label, index) => {
        PhoneBoothArt.cardLine(context, index, label);
      });
    });
  }

  /**
   * Pinta una textura con más resolución que las del resto del puesto (el teléfono se ve de muy cerca): el
   * canvas se agranda `DETAIL` veces y el dibujo se escala, así las medidas lógicas no cambian.
   *
   * @param width Ancho lógico.
   * @param height Alto lógico.
   * @param draw Función de dibujo en medidas lógicas.
   * @returns Textura.
   */
  private paint(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void): Texture {
    const detail = PhoneBoothArt.DETAIL;
    return this.textures.paint(width * detail, height * detail, (context) => {
      context.scale(detail, detail);
      draw(context);
    });
  }

  /**
   * Una línea de la tarjeta: número en rojo, nombre en tinta oscura y una raya debajo.
   *
   * @param context Contexto de dibujo.
   * @param index Posición del canal (la tecla es `index + 1`).
   * @param label Nombre del canal.
   */
  private static cardLine(context: CanvasRenderingContext2D, index: number, label: string): void {
    const { width, line, rule } = PhoneBoothArt.CARD;
    const y = line.top + index * line.step;
    context.textAlign = 'left';
    context.font = `700 ${String(line.size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillStyle = line.number;
    context.fillText(String(index + 1), line.indent, y);
    context.fillStyle = line.label;
    context.fillText(label.toUpperCase(), line.indent + line.gap, y, width - line.indent - line.gap);
    context.fillStyle = rule.color;
    context.fillRect(line.indent, y + rule.offset, width - line.indent * 2, 1);
  }
}
