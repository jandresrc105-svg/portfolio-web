import type { CanvasTexture } from 'three';
import type { PidLoopService } from '@shared/control/PidLoopService';
import type { ScopeService } from '../../services/ScopeService';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pantalla LCD de un osciloscopio digital, dibujada en canvas: fondo negro, retícula punteada, referencia
 * r(t) en cian (CH2) y salida del lazo y(t) en amarillo (CH1) con un halo suave, marcadores de tierra y
 * barras de estado (RUN/STOP, base de tiempo, generador, escalas, ganancias y mediciones). Sigue el estado
 * del equipo: escalas, posición, canales visibles y mediciones. Dispara en el flanco de subida de la
 * referencia, así la traza queda quieta; un poco de ruido de medición la mantiene viva. También dibuja la
 * pantalla de arranque y la pantalla apagada. La retícula se dibuja una vez en un canvas aparte y se copia; las
 * barras de estado se repintan solo cuando cambia su texto, y cada traza se calcula una vez y se traza dos
 * veces (halo y línea) recortada al área de trazado.
 */
export class OscilloscopeDisplay {
  private static readonly CANVAS = { width: 512, height: 320, samples: 256 };
  private static readonly BARS = { top: 26, bottom: 44 };
  private static readonly GRID = { ticks: 5, tick: 3 };
  private static readonly PRE_TRIGGER = 0.1;
  private static readonly NOISE = 0.012;
  private static readonly MARKER = { width: 8, height: 6 };
  private static readonly BOOT = { y: 140, subtitle: 168, bar: { width: 180, height: 5, y: 200 } };
  private static readonly COLORS = {
    background: '#030507',
    bar: '#0c1015',
    grid: 'rgba(190, 205, 220, 0.16)',
    axis: 'rgba(190, 205, 220, 0.34)',
    text: '#c9d1d9',
    dim: '#7a8591',
    run: '#39e07a',
    stop: '#ff4a3d',
    wait: '#ffa23a',
    ink: '#05070a',
    off: '#000000',
  };
  private static readonly CHANNELS = [
    { color: '#ffe14a', halo: 'rgba(255, 225, 74, 0.18)', width: 1.8, glow: 4 },
    { color: '#3fd8ff', halo: 'rgba(63, 216, 255, 0.14)', width: 1.4, glow: 3.5 },
  ];
  private static readonly FONT = { size: 11, title: 22, gap: 8, margin: 7, badge: 14 };
  private static readonly WEIGHT = { regular: 500, semi: 600, bold: 700 };
  private static readonly DASH = [{ on: 1 }, { off: 4 }];
  private static readonly ROWS = { first: 0.75, second: 0.25 };
  private static readonly COLUMNS = { timebase: 0.33, generator: 0.5 };
  private static readonly STYLES = {
    brand: { color: OscilloscopeDisplay.COLORS.text, weight: OscilloscopeDisplay.WEIGHT.bold },
    left: { color: OscilloscopeDisplay.COLORS.text, weight: OscilloscopeDisplay.WEIGHT.semi },
    trigger: {
      color: OscilloscopeDisplay.COLORS.dim,
      weight: OscilloscopeDisplay.WEIGHT.semi,
      align: 'right',
    },
    gains: {
      color: OscilloscopeDisplay.COLORS.text,
      weight: OscilloscopeDisplay.WEIGHT.bold,
      align: 'right',
    },
    readout: { color: OscilloscopeDisplay.COLORS.dim, weight: OscilloscopeDisplay.WEIGHT.regular },
    ink: { color: OscilloscopeDisplay.COLORS.ink, weight: OscilloscopeDisplay.WEIGHT.bold },
    boot: {
      color: OscilloscopeDisplay.COLORS.text,
      weight: OscilloscopeDisplay.WEIGHT.bold,
      align: 'center',
    },
    bootDim: {
      color: OscilloscopeDisplay.COLORS.dim,
      weight: OscilloscopeDisplay.WEIGHT.regular,
      align: 'center',
    },
  } as const;
  private static readonly TEXT = {
    brand: 'JR·DSO',
    bootTitle: 'JR INSTRUMENTS',
    bootSubtitle: 'DSO1104 · iniciando…',
    trigger: 'T↑ CH2  0.00V',
    hidden: 'MENU ▸ mediciones ocultas',
  };
  private static readonly MILLI = 1000;

  private readonly jitter = new Float32Array(OscilloscopeDisplay.CANVAS.samples);
  private readonly trace = new Float32Array(OscilloscopeDisplay.CANVAS.samples);
  private readonly area = OscilloscopeDisplay.plotArea();
  private context: CanvasRenderingContext2D | null = null;
  private plate: CanvasRenderingContext2D | null = null;
  private texture: CanvasTexture | null = null;
  private shown = { top: '', bottom: '', blank: false };

  /**
   * Crea la pantalla.
   *
   * @param textures Fábrica de texturas.
   * @param loop Lazo PID que se muestra.
   * @param scope Estado del osciloscopio.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly loop: PidLoopService,
    private readonly scope: ScopeService,
  ) {}

  /**
   * Crea la textura de la pantalla (se redibuja sobre el mismo canvas).
   *
   * @returns Textura dinámica.
   */
  public create(): CanvasTexture {
    const { width, height } = OscilloscopeDisplay.CANVAS;
    this.texture = this.textures.paint(
      width,
      height,
      (context) => {
        this.context = context;
        context.lineJoin = 'round';
        context.textBaseline = 'middle';
      },
      1,
    );
    this.plate = CanvasTextureFactory.surface(width, height);
    OscilloscopeDisplay.clear(this.plate, OscilloscopeDisplay.COLORS.background);
    this.drawGrid(this.plate);
    return this.texture;
  }

  /**
   * Redibuja la pantalla en funcionamiento.
   *
   * @param blink Si el indicador de disparo está encendido en este cuadro.
   * @param acquire Si toma una medición nueva (en STOP se conserva el ruido de la última).
   */
  public draw(blink: boolean, acquire: boolean): void {
    const context = this.context;
    if (!context) {
      return;
    }
    if (acquire) {
      for (let index = 0; index < this.jitter.length; index += 1) {
        this.jitter[index] = (Math.random() - 1 / 2) * OscilloscopeDisplay.NOISE;
      }
    }
    this.shown.blank = false;
    this.drawPlot(context);
    this.drawTopBar(context, blink);
    this.drawBottomBar(context);
    this.commit();
  }

  /**
   * Pantalla de arranque: marca, modelo y barra de progreso.
   *
   * @param progress Avance del arranque [0, 1].
   */
  public drawBoot(progress: number): void {
    const context = this.context;
    if (!context) {
      return;
    }
    const { width } = OscilloscopeDisplay.CANVAS;
    const { y, subtitle } = OscilloscopeDisplay.BOOT;
    const { STYLES, TEXT, COLORS, FONT } = OscilloscopeDisplay;
    this.shown = { top: '', bottom: '', blank: false };
    OscilloscopeDisplay.clear(context, COLORS.background);
    OscilloscopeDisplay.text(context, TEXT.bootTitle, { x: width / 2, y }, STYLES.boot, FONT.title);
    OscilloscopeDisplay.text(context, TEXT.bootSubtitle, { x: width / 2, y: subtitle }, STYLES.bootDim);
    OscilloscopeDisplay.progressBar(context, progress);
    this.commit();
  }

  /**
   * Pantalla apagada.
   */
  public drawOff(): void {
    if (this.context && !this.shown.blank) {
      this.shown = { top: '', bottom: '', blank: true };
      OscilloscopeDisplay.clear(this.context, OscilloscopeDisplay.COLORS.off);
      this.commit();
    }
  }

  /**
   * Área de trazado: copia la retícula y dibuja los canales sin salirse de ella (las barras quedan intactas).
   *
   * @param context Contexto 2D.
   */
  private drawPlot(context: CanvasRenderingContext2D): void {
    const { width } = OscilloscopeDisplay.CANVAS;
    const { top, plotHeight } = this.area;
    if (this.plate) {
      context.drawImage(this.plate.canvas, 0, top, width, plotHeight, 0, top, width, plotHeight);
    }
    context.save();
    context.beginPath();
    context.rect(0, top, width, plotHeight);
    context.clip();
    this.drawChannels(context);
    context.restore();
  }

  /**
   * Retícula punteada y ejes centrales con subdivisiones.
   *
   * @param context Contexto 2D.
   */
  private drawGrid(context: CanvasRenderingContext2D): void {
    const { width } = OscilloscopeDisplay.CANVAS;
    const { columns, rows } = this.scope.divisions;
    const { top, plotHeight } = this.area;
    context.lineWidth = 1;
    context.strokeStyle = OscilloscopeDisplay.COLORS.grid;
    context.setLineDash(OscilloscopeDisplay.DASH.map((part) => ('on' in part ? part.on : part.off)));
    context.beginPath();
    for (let column = 1; column < columns; column += 1) {
      context.moveTo((width / columns) * column, top);
      context.lineTo((width / columns) * column, top + plotHeight);
    }
    for (let row = 1; row < rows; row += 1) {
      context.moveTo(0, top + (plotHeight / rows) * row);
      context.lineTo(width, top + (plotHeight / rows) * row);
    }
    context.stroke();
    context.setLineDash([]);
    this.drawAxes(context);
  }

  /**
   * Ejes centrales con marcas finas.
   *
   * @param context Contexto 2D.
   */
  private drawAxes(context: CanvasRenderingContext2D): void {
    const { width } = OscilloscopeDisplay.CANVAS;
    const { ticks, tick } = OscilloscopeDisplay.GRID;
    const { top, plotHeight } = this.area;
    const middle = top + plotHeight / 2;
    context.strokeStyle = OscilloscopeDisplay.COLORS.axis;
    context.beginPath();
    context.moveTo(0, middle);
    context.lineTo(width, middle);
    context.moveTo(width / 2, top);
    context.lineTo(width / 2, top + plotHeight);
    const step = width / this.scope.divisions.columns / ticks;
    for (let x = step; x < width; x += step) {
      context.moveTo(x, middle - tick);
      context.lineTo(x, middle + tick);
    }
    context.stroke();
  }

  /**
   * Canales visibles (CH2 primero), cada uno con su marcador de tierra, halo y trazo fino sobre la misma
   * traza.
   *
   * @param context Contexto 2D.
   */
  private drawChannels(context: CanvasRenderingContext2D): void {
    const { channels } = this.scope.state;
    for (let channel = OscilloscopeDisplay.CHANNELS.length - 1; channel >= 0; channel -= 1) {
      const style = OscilloscopeDisplay.CHANNELS[channel];
      if (channels[channel] === true && style) {
        this.drawMarker(context, style.color);
        this.sample(channel);
        this.tracePath(context);
        OscilloscopeDisplay.strokePath(context, style.halo, style.width * style.glow);
        OscilloscopeDisplay.strokePath(context, style.color, style.width);
      }
    }
  }

  /**
   * Marcador de tierra del canal en el borde izquierdo.
   *
   * @param context Contexto 2D.
   * @param color Color del canal.
   */
  private drawMarker(context: CanvasRenderingContext2D, color: string): void {
    const { width, height } = OscilloscopeDisplay.MARKER;
    const y = this.plotY(0, this.area);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, y - height / 2);
    context.lineTo(width, y);
    context.lineTo(0, y + height / 2);
    context.fill();
  }

  /**
   * Muestrea un canal en la ventana de tiempo actual, empezando un poco antes del disparo, y guarda la altura
   * en pantalla de cada muestra.
   *
   * @param channel Canal (0: salida del lazo con ruido de medición; 1: referencia).
   */
  private sample(channel: number): void {
    const { samples } = OscilloscopeDisplay.CANVAS;
    const window = this.scope.timePerDivision * this.scope.divisions.columns;
    const start = -window * OscilloscopeDisplay.PRE_TRIGGER;
    const area = this.area;
    for (let index = 0; index < samples; index += 1) {
      const time = start + (index / (samples - 1)) * window;
      const value =
        channel === 0 ? this.loop.output(time) + (this.jitter[index] ?? 0) : this.loop.setpoint(time);
      this.trace[index] = this.plotY(value, area);
    }
  }

  /**
   * Arma el trazo de las muestras guardadas.
   *
   * @param context Contexto 2D.
   */
  private tracePath(context: CanvasRenderingContext2D): void {
    const { width, samples } = OscilloscopeDisplay.CANVAS;
    context.beginPath();
    for (let index = 0; index < samples; index += 1) {
      context.lineTo((index / (samples - 1)) * width, this.trace[index] ?? 0);
    }
  }

  /**
   * Barra superior: marca, estado (RUN, STOP o WAIT), base de tiempo, generador y disparo.
   *
   * @param context Contexto 2D.
   * @param blink Si el indicador de disparo está encendido.
   */
  private drawTopBar(context: CanvasRenderingContext2D, blink: boolean): void {
    const { width } = OscilloscopeDisplay.CANVAS;
    const middle = OscilloscopeDisplay.BARS.top / 2;
    const { margin } = OscilloscopeDisplay.FONT;
    const { TEXT, STYLES, CHANNELS, COLUMNS } = OscilloscopeDisplay;
    const status = this.status();
    const timebase = `H ${OscilloscopeDisplay.units(this.scope.timePerDivision, 's')}`;
    const generator = this.generatorText();
    const color = blink ? (CHANNELS[1]?.color ?? STYLES.trigger.color) : STYLES.trigger.color;
    if (!this.changed('top', `${status.text}|${timebase}|${generator}|${color}`)) {
      return;
    }
    OscilloscopeDisplay.bar(context, 0, OscilloscopeDisplay.BARS.top);
    this.drawStatus(context, middle, status);
    OscilloscopeDisplay.text(context, timebase, { x: width * COLUMNS.timebase, y: middle }, STYLES.left);
    OscilloscopeDisplay.text(context, generator, { x: width * COLUMNS.generator, y: middle }, STYLES.left);
    const trigger = { ...STYLES.trigger, color };
    OscilloscopeDisplay.text(context, TEXT.trigger, { x: width - margin, y: middle }, trigger);
  }

  /**
   * Anota lo que muestra una barra de estado.
   *
   * @param bar Barra.
   * @param key Resumen de lo que muestra ahora.
   * @returns Si cambió desde la última vez (y hay que repintarla).
   */
  private changed(bar: 'top' | 'bottom', key: string): boolean {
    if (this.shown[bar] === key) {
      return false;
    }
    this.shown[bar] = key;
    return true;
  }

  /**
   * Marca y etiqueta de estado (RUN, STOP o WAIT).
   *
   * @param context Contexto 2D.
   * @param middle Línea media de la barra.
   * @param status Texto y color de la etiqueta.
   * @param status.text Texto.
   * @param status.color Color.
   */
  private drawStatus(
    context: CanvasRenderingContext2D,
    middle: number,
    status: { text: string; color: string },
  ): void {
    const { margin } = OscilloscopeDisplay.FONT;
    const { TEXT, STYLES } = OscilloscopeDisplay;
    OscilloscopeDisplay.text(context, TEXT.brand, { x: margin, y: middle }, STYLES.brand);
    const x = margin + OscilloscopeDisplay.measure(context, `${TEXT.brand}  `);
    OscilloscopeDisplay.badge(context, status.text, x, middle, status.color);
  }

  /**
   * Barra inferior: escalas de los canales, ganancias del PID y mediciones automáticas.
   *
   * @param context Contexto 2D.
   */
  private drawBottomBar(context: CanvasRenderingContext2D): void {
    const { width, height } = OscilloscopeDisplay.CANVAS;
    const { bottom } = OscilloscopeDisplay.BARS;
    const { margin } = OscilloscopeDisplay.FONT;
    const { ROWS, STYLES } = OscilloscopeDisplay;
    const scale = OscilloscopeDisplay.units(this.scope.voltsPerDivision, 'V');
    const gains = this.gainsText();
    const readout = this.scope.state.measurements ? this.readout() : OscilloscopeDisplay.TEXT.hidden;
    const [one, two] = this.scope.state.channels;
    if (!this.changed('bottom', `${scale}|${String(one)}|${String(two)}|${gains}|${readout}`)) {
      return;
    }
    const first = height - bottom * ROWS.first;
    OscilloscopeDisplay.bar(context, height - bottom, bottom);
    this.drawScaleBadges(context, first, scale);
    OscilloscopeDisplay.text(context, gains, { x: width - margin, y: first }, STYLES.gains);
    const second = { x: margin, y: height - bottom * ROWS.second };
    OscilloscopeDisplay.text(context, readout, second, STYLES.readout);
  }

  /**
   * Etiquetas de escala de CH1 y CH2 (en gris si el canal está oculto).
   *
   * @param context Contexto 2D.
   * @param y Línea media.
   * @param scale Escala vertical (texto).
   */
  private drawScaleBadges(context: CanvasRenderingContext2D, y: number, scale: string): void {
    const { COLORS, FONT } = OscilloscopeDisplay;
    let x = FONT.margin;
    OscilloscopeDisplay.CHANNELS.forEach(({ color }, index) => {
      const shown = this.scope.state.channels[index] === true ? color : COLORS.dim;
      x = OscilloscopeDisplay.badge(context, `${String(index + 1)} ${scale}`, x, y, shown);
    });
  }

  /**
   * Estado de adquisición.
   *
   * @returns Texto y color de la etiqueta.
   */
  private status(): { text: string; color: string } {
    const { running, single } = this.scope.state;
    const { COLORS } = OscilloscopeDisplay;
    if (single) {
      return { text: 'WAIT', color: COLORS.wait };
    }
    return running ? { text: 'RUN', color: COLORS.run } : { text: 'STOP', color: COLORS.stop };
  }

  /**
   * Salida del generador: amplitud y frecuencia de la onda cuadrada.
   *
   * @returns Texto.
   */
  private generatorText(): string {
    const { amplitude, frequency } = this.loop.signal;
    return `GEN ⎍ ${amplitude.toFixed(2)}V ${frequency.toFixed(2)}Hz`;
  }

  /**
   * Ganancias actuales del PID.
   *
   * @returns Texto de la lectura.
   */
  private gainsText(): string {
    const { kp, ki, kd } = this.loop.gains;
    return `PID  Kp ${kp.toFixed(1)}  Ki ${ki.toFixed(1)}  Kd ${kd.toFixed(2)}`;
  }

  /**
   * Mediciones automáticas del escalón de subida.
   *
   * @returns Texto de la línea de mediciones.
   */
  private readout(): string {
    const { overshoot, settlingTime, riseTime, steadyError } = this.loop.metrics;
    const seconds = (value: number | null): string => (value === null ? '----' : `${value.toFixed(2)}s`);
    return `Overshoot ${overshoot.toFixed(1)}%   Settle ${seconds(settlingTime)}   Rise ${seconds(riseTime)}   Err ${steadyError.toFixed(1)}%`;
  }

  /**
   * Altura en pantalla de un valor según la escala y la posición, recortada al área de trazado.
   *
   * @param value Valor de la señal (V).
   * @param area Área de trazado.
   * @param area.top Borde superior.
   * @param area.plotHeight Alto.
   * @returns Coordenada vertical en píxeles.
   */
  private plotY(value: number, area: { top: number; plotHeight: number }): number {
    const { top, plotHeight } = area;
    const divisions = value / this.scope.voltsPerDivision + this.scope.state.position;
    const y = top + plotHeight / 2 - divisions * (plotHeight / this.scope.divisions.rows);
    return Math.min(Math.max(y, top), top + plotHeight);
  }

  /**
   * Sube el canvas a la GPU.
   */
  private commit(): void {
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  /**
   * Barra de progreso del arranque.
   *
   * @param context Contexto 2D.
   * @param progress Avance [0, 1].
   */
  private static progressBar(context: CanvasRenderingContext2D, progress: number): void {
    const { width } = OscilloscopeDisplay.CANVAS;
    const { bar } = OscilloscopeDisplay.BOOT;
    const left = (width - bar.width) / 2;
    context.fillStyle = OscilloscopeDisplay.COLORS.axis;
    context.fillRect(left, bar.y, bar.width, bar.height);
    context.fillStyle = OscilloscopeDisplay.COLORS.run;
    context.fillRect(left, bar.y, bar.width * Math.min(Math.max(progress, 0), 1), bar.height);
  }

  /**
   * Traza el camino actual con un color y un grosor.
   *
   * @param context Contexto 2D.
   * @param color Color.
   * @param lineWidth Grosor.
   */
  private static strokePath(context: CanvasRenderingContext2D, color: string, lineWidth: number): void {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  }

  /**
   * Pinta toda la pantalla de un color.
   *
   * @param context Contexto 2D.
   * @param color Color.
   */
  private static clear(context: CanvasRenderingContext2D, color: string): void {
    const { width, height } = OscilloscopeDisplay.CANVAS;
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
  }

  /**
   * Fondo de una barra de estado con su línea divisoria.
   *
   * @param context Contexto 2D.
   * @param y Borde superior.
   * @param height Alto.
   */
  private static bar(context: CanvasRenderingContext2D, y: number, height: number): void {
    const { width } = OscilloscopeDisplay.CANVAS;
    context.fillStyle = OscilloscopeDisplay.COLORS.bar;
    context.fillRect(0, y, width, height);
    context.fillStyle = OscilloscopeDisplay.COLORS.axis;
    context.fillRect(0, y === 0 ? height - 1 : y, width, 1);
  }

  /**
   * Escribe un texto con la tipografía monoespaciada de la pantalla.
   *
   * @param context Contexto 2D.
   * @param text Texto.
   * @param at Posición (x según la alineación, y en la línea media).
   * @param at.x Horizontal.
   * @param at.y Vertical.
   * @param style Color, peso y alineación (izquierda por defecto).
   * @param style.color Color.
   * @param style.weight Peso tipográfico.
   * @param style.align Alineación.
   * @param size Tamaño de letra en píxeles.
   */
  private static text(
    context: CanvasRenderingContext2D,
    text: string,
    at: { x: number; y: number },
    style: { color: string; weight: number; align?: CanvasTextAlign },
    size = OscilloscopeDisplay.FONT.size,
  ): void {
    context.font = `${String(style.weight)} ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillStyle = style.color;
    context.textAlign = style.align ?? 'left';
    context.fillText(text, at.x, at.y);
  }

  /**
   * Etiqueta con fondo de color (canal o estado).
   *
   * @param context Contexto 2D.
   * @param text Texto.
   * @param x Borde izquierdo.
   * @param y Línea media.
   * @param color Color de fondo.
   * @returns Posición donde puede ir la siguiente etiqueta.
   */
  private static badge(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
  ): number {
    const { badge, gap, margin } = OscilloscopeDisplay.FONT;
    const width = OscilloscopeDisplay.measure(context, text) + margin;
    context.fillStyle = color;
    context.fillRect(x, y - badge / 2, width, badge);
    OscilloscopeDisplay.text(context, text, { x: x + margin / 2, y }, OscilloscopeDisplay.STYLES.ink);
    return x + width + gap;
  }

  /**
   * Ancho de un texto con la tipografía de la pantalla.
   *
   * @param context Contexto 2D.
   * @param text Texto.
   * @returns Ancho en píxeles.
   */
  private static measure(context: CanvasRenderingContext2D, text: string): number {
    const { WEIGHT, FONT } = OscilloscopeDisplay;
    context.font = `${String(WEIGHT.bold)} ${String(FONT.size)}px ${CanvasTextureFactory.MONO_FONT}`;
    return context.measureText(text).width;
  }

  /**
   * Valor con prefijo mili si es menor que 1 (500mV, 200ms, 1V).
   *
   * @param value Valor en la unidad base.
   * @param unit Unidad.
   * @returns Texto.
   */
  private static units(value: number, unit: string): string {
    return value < 1
      ? `${String(Math.round(value * OscilloscopeDisplay.MILLI))}m${unit}`
      : `${String(value)}${unit}`;
  }

  /**
   * Zona de la retícula (entre las barras de estado).
   *
   * @returns Borde superior y alto del área de trazado.
   */
  private static plotArea(): { top: number; plotHeight: number } {
    const { top, bottom } = OscilloscopeDisplay.BARS;
    return { top, plotHeight: OscilloscopeDisplay.CANVAS.height - top - bottom };
  }
}
