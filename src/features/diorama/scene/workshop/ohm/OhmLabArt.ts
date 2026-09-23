import type { CanvasTexture, Texture } from 'three';
import { CanvasTextureFactory } from '../../CanvasTextureFactory';

/**
 * Serigrafías fijas del circuito de la Ley de Ohm, dibujadas una sola vez en canvas: el panel de la década
 * (escalas 0–9 alrededor de cada perilla), la protoboard, la etiqueta de la batería de 9 V y la del cajón de
 * repuestos.
 */
export class OhmLabArt {
  private static readonly PANEL = {
    width: 256,
    height: 128,
    background: '#1d2126',
    ink: '#d9dde2',
    accent: '#ffb347',
    size: 9,
    title: 10,
  };
  private static readonly DIGITS = 10;
  private static readonly DIAL = { start: -0.75, sweep: 1.5, tick: 4, gap: 5, number: 11 };
  private static readonly BOARD = {
    width: 128,
    height: 80,
    background: '#eeeae0',
    hole: '#5a5a55',
    red: '#d23c3c',
    blue: '#3a62c8',
    pitch: 6,
    margin: 12,
    rail: 5,
    radius: 1.2,
    channel: 4,
  };
  private static readonly BATTERY = {
    width: 64,
    height: 96,
    top: '#1a1a1a',
    bottom: '#d9a520',
    split: 0.42,
    ink: '#f5f2e8',
    dark: '#1a1a1a',
    size: 26,
    small: 9,
  };
  private static readonly TAG = { width: 64, height: 24, background: '#f4efe2', ink: '#b3261e', size: 12 };

  private readonly painted: Texture[] = [];

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Libera todas las texturas que pintó.
   */
  public dispose(): void {
    this.painted.splice(0).forEach((texture) => {
      texture.dispose();
    });
  }

  /**
   * Panel superior de la década: título y una escala 0–9 con su multiplicador alrededor de cada perilla.
   *
   * @param knobs Centro de cada perilla en fracciones del panel (0–1) y su multiplicador.
   * @param radius Radio de la escala en fracción del alto del panel.
   * @returns Textura.
   */
  public decadePanel(
    knobs: readonly { u: number; v: number; label: string }[],
    radius: number,
  ): CanvasTexture {
    const { width, height, background, accent, title } = OhmLabArt.PANEL;
    return this.keep(
      this.textures.paint(width, height, (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.fillStyle = accent;
        context.font = `bold ${String(title)}px ${CanvasTextureFactory.SANS_FONT}`;
        context.textAlign = 'right';
        context.textBaseline = 'middle';
        context.fillText('DÉCADA DE RESISTENCIAS', width - title, title);
        knobs.forEach((knob) => {
          this.dial(context, { x: knob.u * width, y: knob.v * height, radius: radius * height }, knob.label);
        });
      }),
    );
  }

  /**
   * Protoboard: agujeros en grupos de cinco, canal central y rieles rojo y azul.
   *
   * @returns Textura.
   */
  public breadboard(): CanvasTexture {
    const { width, height, background } = OhmLabArt.BOARD;
    return this.keep(
      this.textures.paint(width, height, (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        this.rails(context);
        this.holes(context);
      }),
    );
  }

  /**
   * Etiqueta de la batería de 9 V (frente).
   *
   * @returns Textura.
   */
  public battery(): CanvasTexture {
    const { width, height, top, bottom, split, ink, dark, size, small } = OhmLabArt.BATTERY;
    return this.keep(
      this.textures.paint(width, height, (context) => {
        context.fillStyle = top;
        context.fillRect(0, 0, width, height * split);
        context.fillStyle = bottom;
        context.fillRect(0, height * split, width, height * (1 - split));
        context.textAlign = 'center';
        context.fillStyle = ink;
        context.font = `bold ${String(size)}px ${CanvasTextureFactory.SANS_FONT}`;
        context.fillText('9V', width / 2, height * split - small);
        context.fillStyle = dark;
        context.font = `bold ${String(small)}px ${CanvasTextureFactory.SANS_FONT}`;
        context.fillText('ALKALINE', width / 2, (height * (split + 1)) / 2 + small / 2);
      }),
    );
  }

  /**
   * Etiqueta del cajón de repuestos.
   *
   * @returns Textura.
   */
  public drawerTag(): CanvasTexture {
    const { width, height, background, ink, size } = OhmLabArt.TAG;
    return this.keep(
      this.textures.paint(width, height, (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.fillStyle = ink;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `bold ${String(size)}px ${CanvasTextureFactory.SANS_FONT}`;
        context.fillText('LED 5mm', width / 2, height / 2);
      }),
    );
  }

  /**
   * Escala de una perilla: diez marcas con su número y el multiplicador debajo.
   *
   * @param context Contexto de dibujo.
   * @param at Centro y radio de la escala en píxeles.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   * @param at.radius Radio.
   * @param label Multiplicador.
   */
  private dial(
    context: CanvasRenderingContext2D,
    at: { x: number; y: number; radius: number },
    label: string,
  ): void {
    const { ink, size } = OhmLabArt.PANEL;
    context.strokeStyle = ink;
    context.fillStyle = ink;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    for (let digit = 0; digit < OhmLabArt.DIGITS; digit += 1) {
      this.mark(context, at, digit);
    }
    context.font = `bold ${String(size)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.fillText(label, at.x, at.y + at.radius + OhmLabArt.DIAL.number);
  }

  /**
   * Marca y número de una posición de la escala (de −135° a +135°, en sentido horario desde arriba).
   *
   * @param context Contexto de dibujo.
   * @param at Centro y radio de la escala en píxeles.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   * @param at.radius Radio.
   * @param digit Posición 0–9.
   */
  private mark(
    context: CanvasRenderingContext2D,
    at: { x: number; y: number; radius: number },
    digit: number,
  ): void {
    const { start, sweep, tick, gap } = OhmLabArt.DIAL;
    const angle = (start + (sweep * digit) / (OhmLabArt.DIGITS - 1)) * Math.PI;
    const direction = { x: Math.sin(angle), y: -Math.cos(angle) };
    context.beginPath();
    context.moveTo(at.x + direction.x * at.radius, at.y + direction.y * at.radius);
    context.lineTo(at.x + direction.x * (at.radius + tick), at.y + direction.y * (at.radius + tick));
    context.stroke();
    const far = at.radius + tick + gap;
    context.fillText(String(digit), at.x + direction.x * far, at.y + direction.y * far);
  }

  /**
   * Rieles de alimentación arriba y abajo (rojo + y azul −).
   *
   * @param context Contexto de dibujo.
   */
  private rails(context: CanvasRenderingContext2D): void {
    const { width, height, red, blue, rail, channel } = OhmLabArt.BOARD;
    context.lineWidth = 1;
    [
      { y: rail / 2, color: red },
      { y: height - rail / 2, color: blue },
    ].forEach(({ y, color }) => {
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(rail, y);
      context.lineTo(width - rail, y);
      context.stroke();
    });
    context.fillStyle = 'rgba(0, 0, 0, 0.12)';
    context.fillRect(0, height / 2 - channel / 2, width, channel);
  }

  /**
   * Agujeros de la protoboard en filas, con el canal central libre.
   *
   * @param context Contexto de dibujo.
   */
  private holes(context: CanvasRenderingContext2D): void {
    const { width, height, hole, pitch, margin, radius, channel } = OhmLabArt.BOARD;
    context.fillStyle = hole;
    for (let y = margin; y < height - margin / 2; y += pitch) {
      if (Math.abs(y - height / 2) < channel) {
        continue;
      }
      for (let x = pitch; x < width - pitch / 2; x += pitch) {
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    }
  }

  /**
   * Guarda una textura para liberarla al final.
   *
   * @param texture Textura pintada.
   * @returns La misma textura.
   */
  private keep(texture: CanvasTexture): CanvasTexture {
    this.painted.push(texture);
    return texture;
  }
}
