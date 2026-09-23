import type { CanvasTexture } from 'three';
import type { OhmLabState } from '../../models/OhmLabState';
import { OhmLabText } from '../../services/OhmLabText';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pantallas del circuito de la Ley de Ohm dibujadas en canvas: el display de la década (la resistencia en
 * dígitos rojos), el panel de medición (V, R, I y P en vivo, una barra de corriente contra el límite del LED
 * y el estado del circuito) y la placa con el valor de la resistencia gigante. Son pequeñas y solo se
 * redibujan cuando cambia lo que muestran.
 */
export class OhmDisplays {
  private static readonly DECADE = {
    width: 160,
    height: 40,
    background: '#0a0b0c',
    ghost: 'rgba(255, 70, 50, 0.1)',
    color: '#ff4632',
    size: 28,
    unit: 16,
    pad: 10,
  };
  private static readonly METER = {
    width: 256,
    height: 160,
    background: '#04110d',
    grid: 'rgba(80, 255, 190, 0.06)',
    header: '#4fd8ff',
    label: '#7df9c8',
    value: '#e9fff6',
    size: 22,
    small: 11,
    pad: 12,
    top: 20,
    row: 24,
  };
  private static readonly BAR = { y: 128, height: 8, track: '#123027', safe: '#3dff7a', warn: '#ffc93d' };
  private static readonly STATUS = { ok: '#3dff7a', alert: '#ff4b36', idle: '#8aa39a', y: 151 };
  private static readonly WARN_FRACTION = 0.75;
  private static readonly OVERSHOOT = 1.25;
  private static readonly PLAQUE = {
    width: 128,
    height: 32,
    background: '#15181c',
    ink: '#f2e6c8',
    size: 15,
  };
  private static readonly DIGITS = 4;

  private readonly text = new OhmLabText();

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Display de la década: la resistencia en cuatro dígitos (con los apagados de fondo) y la unidad.
   *
   * @param ohms Resistencia.
   * @returns Textura.
   */
  public decade(ohms: number): CanvasTexture {
    const { width, height, background, ghost, color, size, unit, pad } = OhmDisplays.DECADE;
    return this.textures.paint(
      width,
      height,
      (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.textBaseline = 'middle';
        context.font = `bold ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
        OhmDisplays.digits(context, ohms, { ghost, color, x: pad, y: height / 2 });
        context.font = `bold ${String(unit)}px ${CanvasTextureFactory.SANS_FONT}`;
        context.textAlign = 'right';
        context.fillText('Ω', width - pad, height / 2);
      },
      1,
    );
  }

  /**
   * Panel de medición: V, R, I y P, la barra de corriente y el estado del circuito.
   *
   * @param state Estado del circuito.
   * @param blink Si la alerta está en su fase encendida (parpadea con la sobrecorriente).
   * @returns Textura.
   */
  public meter(state: OhmLabState, blink: boolean): CanvasTexture {
    const { width, height, background } = OhmDisplays.METER;
    return this.textures.paint(
      width,
      height,
      (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        this.grid(context);
        this.readings(context, state);
        this.bar(context, state);
        this.status(context, state, blink);
      },
      1,
    );
  }

  /**
   * Placa de la resistencia gigante con su valor normalizado.
   *
   * @param label Valor, por ejemplo `220 Ω ±5 %`.
   * @returns Textura.
   */
  public plaque(label: string): CanvasTexture {
    const { width, height, background, ink, size } = OhmDisplays.PLAQUE;
    return this.textures.paint(
      width,
      height,
      (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.fillStyle = ink;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `bold ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
        context.fillText(label, width / 2, height / 2);
      },
      1,
    );
  }

  /**
   * Cuadrícula tenue de fondo, como una pantalla de instrumento.
   *
   * @param context Contexto de dibujo.
   */
  private grid(context: CanvasRenderingContext2D): void {
    const { width, height, grid, row } = OhmDisplays.METER;
    context.strokeStyle = grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = row; x < width; x += row) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = row; y < height; y += row) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }

  /**
   * Encabezado con la ley y las cuatro lecturas.
   *
   * @param context Contexto de dibujo.
   * @param state Estado del circuito.
   */
  private readings(context: CanvasRenderingContext2D, state: OhmLabState): void {
    const { header, size, small, pad, top, row } = OhmDisplays.METER;
    context.textBaseline = 'middle';
    context.fillStyle = header;
    context.font = `bold ${String(small)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.textAlign = 'left';
    context.fillText('LEY DE OHM · I = (V − Vf) / R', pad, top / 2 + 2);
    const rows = [
      { name: 'V', text: `${state.closed ? String(state.volts) : '0'} V` },
      { name: 'R', text: this.text.ohms(state.ohms) },
      { name: 'I', text: this.text.amps(state.amps) },
      { name: 'P', text: this.text.watts(state.watts) },
    ];
    context.font = `bold ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    rows.forEach((item, index) => {
      this.line(context, item, top + row * (index + 0.5) + 2);
    });
  }

  /**
   * Una lectura: la magnitud a la izquierda y su valor a la derecha.
   *
   * @param context Contexto de dibujo.
   * @param item Magnitud y valor.
   * @param item.name Magnitud (V, R, I, P).
   * @param item.text Valor con su unidad.
   * @param y Altura de la línea.
   */
  private line(context: CanvasRenderingContext2D, item: { name: string; text: string }, y: number): void {
    const { width, label, value, pad } = OhmDisplays.METER;
    context.textAlign = 'left';
    context.fillStyle = label;
    context.fillText(item.name, pad, y);
    context.textAlign = 'right';
    context.fillStyle = value;
    context.fillText(item.text, width - pad, y);
  }

  /**
   * Barra de corriente contra el límite del LED (marca roja en 40 mA).
   *
   * @param context Contexto de dibujo.
   * @param state Estado del circuito.
   */
  private bar(context: CanvasRenderingContext2D, state: OhmLabState): void {
    const { width, pad } = OhmDisplays.METER;
    const { y, height, track, safe, warn } = OhmDisplays.BAR;
    const span = width - pad * 2;
    const limitX = pad + span / OhmDisplays.OVERSHOOT;
    const fraction = Math.min(state.amps / state.limit, OhmDisplays.OVERSHOOT) / OhmDisplays.OVERSHOOT;
    context.fillStyle = track;
    context.fillRect(pad, y, span, height);
    context.fillStyle = OhmDisplays.barColor(state.amps / state.limit, { safe, warn });
    context.fillRect(pad, y, span * fraction, height);
    context.fillStyle = OhmDisplays.STATUS.alert;
    context.fillRect(limitX - 1, y - 2, 2, height + 2 * 2);
  }

  /**
   * Línea de estado: normal, abierto, cortocircuito, sobrecorriente o LED quemado.
   *
   * @param context Contexto de dibujo.
   * @param state Estado del circuito.
   * @param blink Fase del parpadeo de la alerta.
   */
  private status(context: CanvasRenderingContext2D, state: OhmLabState, blink: boolean): void {
    const { width, small } = OhmDisplays.METER;
    const { text, color } = OhmDisplays.message(state);
    if (color === OhmDisplays.STATUS.alert && state.stress > 0 && !blink) {
      return;
    }
    context.fillStyle = color;
    context.textAlign = 'center';
    context.font = `bold ${String(small)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.fillText(text, width / 2, OhmDisplays.STATUS.y);
  }

  /**
   * Color de la barra según la fracción del límite: verde, amarillo cerca del límite y rojo al pasarlo.
   *
   * @param ratio Corriente / límite.
   * @param colors Colores seguro y de aviso.
   * @param colors.safe Seguro.
   * @param colors.warn Aviso.
   * @returns Color.
   */
  private static barColor(ratio: number, colors: { safe: string; warn: string }): string {
    if (ratio > 1) {
      return OhmDisplays.STATUS.alert;
    }
    return ratio > OhmDisplays.WARN_FRACTION ? colors.warn : colors.safe;
  }

  /**
   * Mensaje y color de la línea de estado.
   *
   * @param state Estado del circuito.
   * @returns Texto y color.
   */
  private static message(state: OhmLabState): { text: string; color: string } {
    const { ok, alert, idle } = OhmDisplays.STATUS;
    if (state.burnt) {
      return { text: 'LED QUEMADO · CÁMBIALO', color: alert };
    }
    if (!state.closed) {
      return { text: 'CIRCUITO ABIERTO', color: idle };
    }
    if (state.short) {
      return { text: '¡CORTOCIRCUITO!', color: alert };
    }
    if (state.amps > state.limit) {
      return { text: '¡SOBRECORRIENTE!', color: alert };
    }
    return { text: 'LED OK · MÁX. 40 mA', color: ok };
  }

  /**
   * Dígitos del display: los segmentos apagados de fondo y el valor encima.
   *
   * @param context Contexto de dibujo.
   * @param ohms Resistencia.
   * @param style Colores y posición.
   * @param style.ghost Color de los segmentos apagados.
   * @param style.color Color de los dígitos.
   * @param style.x Horizontal.
   * @param style.y Vertical.
   */
  private static digits(
    context: CanvasRenderingContext2D,
    ohms: number,
    style: { ghost: string; color: string; x: number; y: number },
  ): void {
    context.fillStyle = style.ghost;
    context.fillText('8888', style.x, style.y);
    context.fillStyle = style.color;
    context.fillText(String(ohms).padStart(OhmDisplays.DIGITS, '0'), style.x, style.y);
  }
}
