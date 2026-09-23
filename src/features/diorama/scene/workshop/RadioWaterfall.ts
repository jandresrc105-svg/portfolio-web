import type { CanvasTexture } from 'three';
import { RadioMode } from '../../models/RadioMode';
import type { RadioState } from '../../models/RadioState';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pantalla del SDR dibujada en canvas: arriba la frecuencia, el modo y la relación señal/ruido; luego el
 * espectro de toda la banda (FFT) con la banda de paso del filtro y la marca de sintonía; debajo la
 * cascada (waterfall), que baja una fila por cuadro y deja ver las portadoras en el tiempo (las balizas CW
 * se ven como trazos punteados: el morse); y abajo el texto que decodifica el receptor, letra por letra.
 */
export class RadioWaterfall {
  public static readonly BINS = 128;

  private static readonly CANVAS = { width: 384, height: 240 };
  private static readonly HEADER = { height: 22, y: 12 };
  private static readonly SPECTRUM = { top: 26, height: 66, grid: 3, line: 1.6 };
  private static readonly AXIS = { top: 94, height: 14, y: 102, step: 100, marker: 5 };
  private static readonly WATERFALL = { top: 110, height: 86 };
  private static readonly FOOTER = { top: 198, first: 213, second: 231 };
  private static readonly MARGIN = 8;
  private static readonly COLORS = {
    background: '#02060c',
    header: '#0b1320',
    text: '#d7e3f0',
    dim: '#6f8196',
    trace: '#7ff3ff',
    fill: 'rgba(63, 216, 255, 0.16)',
    passband: 'rgba(255, 200, 80, 0.16)',
    marker: '#ff4a3d',
    grid: 'rgba(120, 160, 200, 0.14)',
    decoded: '#ffd36b',
    locked: '#39e07a',
    scan: '#ffa23a',
    off: '#000000',
  };
  private static readonly PALETTE = {
    steps: 48,
    stops: [
      { at: 0, r: 2, g: 6, b: 22 },
      { at: 0.3, r: 8, g: 28, b: 96 },
      { at: 0.5, r: 18, g: 120, b: 210 },
      { at: 0.7, r: 60, g: 230, b: 230 },
      { at: 0.85, r: 250, g: 220, b: 70 },
      { at: 1, r: 255, g: 250, b: 235 },
    ],
  };
  private static readonly STYLES = {
    title: { color: RadioWaterfall.COLORS.text, size: 14, weight: 700, mono: false },
    tag: { color: RadioWaterfall.COLORS.text, size: 11, weight: 700, mono: false },
    axis: { color: RadioWaterfall.COLORS.dim, size: 10, weight: 500, mono: false },
    headline: { color: RadioWaterfall.COLORS.decoded, size: 14, weight: 700, mono: true },
    detail: { color: RadioWaterfall.COLORS.dim, size: 11, weight: 500, mono: false },
  };
  private static readonly KHZ_PER_MHZ = 1000;
  private static readonly QUARTER_WAVE = 10.6;

  private readonly palette: string[] = [];
  private context: CanvasRenderingContext2D | null = null;
  private texture: CanvasTexture | null = null;

  /**
   * Crea la pantalla.
   *
   * @param textures Fábrica de texturas.
   * @param band Banda que muestra el espectro, en kHz.
   * @param band.from Borde inferior.
   * @param band.to Borde superior.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly band: { from: number; to: number },
  ) {
    const { steps } = RadioWaterfall.PALETTE;
    for (let index = 0; index < steps; index++) {
      this.palette.push(RadioWaterfall.shade(index / (steps - 1)));
    }
  }

  /**
   * Crea la textura de la pantalla (se redibuja sobre el mismo canvas).
   *
   * @returns Textura dinámica.
   */
  public create(): CanvasTexture {
    const { width, height } = RadioWaterfall.CANVAS;
    this.texture = this.textures.paint(
      width,
      height,
      (context) => {
        this.context = context;
        context.textBaseline = 'middle';
        RadioWaterfall.fill(context, RadioWaterfall.COLORS.off, { top: 0, height });
      },
      1,
    );
    return this.texture;
  }

  /**
   * Redibuja la pantalla en funcionamiento y baja la cascada una fila.
   *
   * @param state Estado del receptor.
   * @param spectrum Espectro de la banda (0 a 1).
   * @param blink Si el cursor del texto está visible.
   */
  public draw(state: RadioState, spectrum: Float32Array, blink: boolean): void {
    const context = this.context;
    if (!context) {
      return;
    }
    this.drawHeader(context, state);
    this.drawSpectrum(context, state, spectrum);
    this.drawAxis(context, state);
    this.drawWaterfall(context, spectrum);
    this.drawFooter(context, state, blink);
    this.commit();
  }

  /**
   * Pantalla apagada (también borra la cascada).
   */
  public drawOff(): void {
    if (this.context) {
      RadioWaterfall.fill(this.context, RadioWaterfall.COLORS.off, {
        top: 0,
        height: RadioWaterfall.CANVAS.height,
      });
      this.commit();
    }
  }

  /**
   * Barra superior: frecuencia, modo, SNR y estado del AFC o la búsqueda.
   *
   * @param context Contexto.
   * @param state Estado.
   */
  private drawHeader(context: CanvasRenderingContext2D, state: RadioState): void {
    const { width } = RadioWaterfall.CANVAS;
    const { height, y } = RadioWaterfall.HEADER;
    const { COLORS, MARGIN, STYLES } = RadioWaterfall;
    RadioWaterfall.fill(context, COLORS.header, { top: 0, height });
    const megahertz = (state.frequency / RadioWaterfall.KHZ_PER_MHZ).toFixed(3);
    RadioWaterfall.text(context, `${megahertz} MHz  ${state.mode}`, { x: MARGIN, y }, STYLES.title);
    const snr = state.station ? `SNR ${state.snr.toFixed(0)} dB` : 'SNR —';
    RadioWaterfall.text(context, snr, { x: width - MARGIN, y, align: 'right' }, STYLES.tag);
    const tag = RadioWaterfall.tag(state);
    if (tag) {
      RadioWaterfall.text(
        context,
        tag.text,
        { x: width / 2 + MARGIN * 2, y },
        { ...STYLES.tag, color: tag.color },
      );
    }
  }

  /**
   * Espectro con la retícula, la banda de paso del filtro y la marca de sintonía.
   *
   * @param context Contexto.
   * @param state Estado.
   * @param spectrum Espectro.
   */
  private drawSpectrum(context: CanvasRenderingContext2D, state: RadioState, spectrum: Float32Array): void {
    const { top, height, line } = RadioWaterfall.SPECTRUM;
    const { COLORS } = RadioWaterfall;
    this.drawGrid(context);
    const left = this.x(state.frequency - state.window);
    context.fillStyle = COLORS.passband;
    context.fillRect(left, top, this.x(state.frequency + state.window) - left, height);
    this.trace(context, spectrum);
    context.fillStyle = COLORS.fill;
    context.fill();
    context.strokeStyle = COLORS.trace;
    context.lineWidth = line;
    context.stroke();
    context.fillStyle = COLORS.marker;
    context.fillRect(Math.round(this.x(state.frequency)), top, 1, height);
  }

  /**
   * Fondo y retícula del espectro.
   *
   * @param context Contexto.
   */
  private drawGrid(context: CanvasRenderingContext2D): void {
    const { width } = RadioWaterfall.CANVAS;
    const { top, height, grid } = RadioWaterfall.SPECTRUM;
    RadioWaterfall.fill(context, RadioWaterfall.COLORS.background, { top, height });
    context.fillStyle = RadioWaterfall.COLORS.grid;
    for (let row = 1; row <= grid; row++) {
      context.fillRect(0, top + (row * height) / (grid + 1), width, 1);
    }
  }

  /**
   * Arma el trazo cerrado del espectro (para rellenarlo y contornearlo).
   *
   * @param context Contexto.
   * @param spectrum Espectro.
   */
  private trace(context: CanvasRenderingContext2D, spectrum: Float32Array): void {
    const { width } = RadioWaterfall.CANVAS;
    const { top, height } = RadioWaterfall.SPECTRUM;
    const bottom = top + height;
    const step = width / Math.max(spectrum.length - 1, 1);
    context.beginPath();
    context.moveTo(0, bottom);
    spectrum.forEach((value, index) => {
      context.lineTo(index * step, bottom - value * height);
    });
    context.lineTo(width, bottom);
    context.closePath();
  }

  /**
   * Escala de frecuencias bajo el espectro, con el triángulo de sintonía.
   *
   * @param context Contexto.
   * @param state Estado.
   */
  private drawAxis(context: CanvasRenderingContext2D, state: RadioState): void {
    const { top, height, y, step, marker } = RadioWaterfall.AXIS;
    const { COLORS, STYLES, KHZ_PER_MHZ } = RadioWaterfall;
    RadioWaterfall.fill(context, COLORS.background, { top, height });
    for (let khz = this.band.from; khz <= this.band.to; khz += step) {
      const at = { x: this.x(khz), y, align: RadioWaterfall.align(khz, this.band) };
      RadioWaterfall.text(context, (khz / KHZ_PER_MHZ).toFixed(1), at, STYLES.axis);
    }
    const x = this.x(state.frequency);
    context.fillStyle = COLORS.marker;
    context.beginPath();
    context.moveTo(x - marker, top + height);
    context.lineTo(x + marker, top + height);
    context.lineTo(x, top + height - marker);
    context.fill();
  }

  /**
   * Baja la cascada una fila y pinta la fila nueva arriba con el espectro de ahora.
   *
   * @param context Contexto.
   * @param spectrum Espectro.
   */
  private drawWaterfall(context: CanvasRenderingContext2D, spectrum: Float32Array): void {
    const { width } = RadioWaterfall.CANVAS;
    const { top, height } = RadioWaterfall.WATERFALL;
    context.drawImage(context.canvas, 0, top, width, height - 1, 0, top + 1, width, height - 1);
    const cell = width / spectrum.length;
    const last = this.palette.length - 1;
    spectrum.forEach((value, index) => {
      context.fillStyle = this.palette[Math.round(value * last)] ?? RadioWaterfall.COLORS.background;
      context.fillRect(Math.floor(index * cell), top, Math.ceil(cell), 1);
    });
  }

  /**
   * Barra inferior: texto decodificado (o la emisora) y el detalle didáctico.
   *
   * @param context Contexto.
   * @param state Estado.
   * @param blink Si el cursor está visible.
   */
  private drawFooter(context: CanvasRenderingContext2D, state: RadioState, blink: boolean): void {
    const { height } = RadioWaterfall.CANVAS;
    const { top, first, second } = RadioWaterfall.FOOTER;
    const { COLORS, STYLES, MARGIN } = RadioWaterfall;
    RadioWaterfall.fill(context, COLORS.header, { top, height: height - top });
    const headline = RadioWaterfall.headline(state, blink);
    RadioWaterfall.text(
      context,
      headline.text,
      { x: MARGIN, y: first },
      { ...STYLES.headline, color: headline.color },
    );
    RadioWaterfall.text(context, RadioWaterfall.detail(state), { x: MARGIN, y: second }, STYLES.detail);
  }

  /**
   * Marca la textura para subirla de nuevo a la GPU.
   */
  private commit(): void {
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  /**
   * Posición horizontal de una frecuencia.
   *
   * @param khz Frecuencia en kHz.
   * @returns Píxeles.
   */
  private x(khz: number): number {
    const { from, to } = this.band;
    return ((khz - from) / (to - from)) * RadioWaterfall.CANVAS.width;
  }

  /**
   * Línea principal del pie.
   *
   * @param state Estado.
   * @param blink Si el cursor está visible.
   * @returns Texto y color.
   */
  private static headline(state: RadioState, blink: boolean): { text: string; color: string } {
    const { COLORS } = RadioWaterfall;
    const station = state.station;
    if (state.decoding || (state.mode === RadioMode.Cw && state.decoded !== '')) {
      return { text: `▸ ${state.decoded}${blink ? '_' : ' '}`, color: COLORS.decoded };
    }
    if (!station) {
      return { text: 'Solo ruido · clic aquí: SCAN', color: COLORS.dim };
    }
    if (station.mode !== state.mode) {
      return { text: `${station.label} · cambia a ${station.mode}`, color: COLORS.scan };
    }
    return { text: `♪ ${station.label} · ${station.mode}`, color: COLORS.text };
  }

  /**
   * Línea de detalle del pie.
   *
   * @param state Estado.
   * @returns Texto.
   */
  private static detail(state: RadioState): string {
    if (state.decoding) {
      const current = state.pattern === '' ? '·' : state.pattern;
      const last = state.lastSymbol === '' ? '' : `   última: ${state.lastSymbol}`;
      return `morse: ${current}${last}`;
    }
    const antenna = `ANT ${state.antennaLength.toFixed(2)} m (λ/4 ≈ ${String(RadioWaterfall.QUARTER_WAVE)} m)`;
    return `${antenna} · C1 ${state.capacitance.toFixed(0)} pF`;
  }

  /**
   * Etiqueta de estado de la sintonía.
   *
   * @param state Estado.
   * @returns Texto y color, o `null`.
   */
  private static tag(state: RadioState): { text: string; color: string } | null {
    if (state.scanning) {
      return { text: 'SCAN ▸', color: RadioWaterfall.COLORS.scan };
    }
    return state.locked ? { text: 'AFC ●', color: RadioWaterfall.COLORS.locked } : null;
  }

  /**
   * Alineación de un número de la escala (los extremos hacia adentro).
   *
   * @param khz Frecuencia.
   * @param band Banda.
   * @param band.from Borde inferior.
   * @param band.to Borde superior.
   * @returns Alineación.
   */
  private static align(khz: number, band: { from: number; to: number }): CanvasTextAlign {
    if (khz <= band.from) {
      return 'left';
    }
    return khz >= band.to ? 'right' : 'center';
  }

  /**
   * Escribe un texto.
   *
   * @param context Contexto.
   * @param text Texto.
   * @param at Posición (y al centro) y alineación.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   * @param at.align Alineación (izquierda si falta).
   * @param style Color, tamaño, grosor y familia.
   * @param style.color Color.
   * @param style.size Tamaño.
   * @param style.weight Grosor.
   * @param style.mono Si usa letra monoespaciada.
   */
  private static text(
    context: CanvasRenderingContext2D,
    text: string,
    at: { x: number; y: number; align?: CanvasTextAlign },
    style: { color: string; size: number; weight: number; mono: boolean },
  ): void {
    const family = style.mono ? CanvasTextureFactory.MONO_FONT : CanvasTextureFactory.SANS_FONT;
    context.font = `${String(style.weight)} ${String(style.size)}px ${family}`;
    context.fillStyle = style.color;
    context.textAlign = at.align ?? 'left';
    context.fillText(text, at.x, at.y);
  }

  /**
   * Rellena una franja horizontal.
   *
   * @param context Contexto.
   * @param color Color.
   * @param band Franja.
   * @param band.top Borde superior.
   * @param band.height Alto.
   */
  private static fill(
    context: CanvasRenderingContext2D,
    color: string,
    band: { top: number; height: number },
  ): void {
    context.fillStyle = color;
    context.fillRect(0, band.top, RadioWaterfall.CANVAS.width, band.height);
  }

  /**
   * Color de la paleta de la cascada para un nivel.
   *
   * @param value Nivel (0 a 1).
   * @returns Color CSS.
   */
  private static shade(value: number): string {
    const stops = RadioWaterfall.PALETTE.stops;
    const upper = stops.findIndex((stop) => stop.at >= value);
    const high = stops[Math.max(upper, 0)] ?? { at: 1, r: 0, g: 0, b: 0 };
    const low = stops[Math.max(upper - 1, 0)] ?? high;
    const mix = high.at > low.at ? (value - low.at) / (high.at - low.at) : 0;
    const channel = (from: number, to: number): number => Math.round(from + (to - from) * mix);
    return `rgb(${String(channel(low.r, high.r))}, ${String(channel(low.g, high.g))}, ${String(channel(low.b, high.b))})`;
  }
}
