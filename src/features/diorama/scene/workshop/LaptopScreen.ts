import type { CanvasTexture } from 'three';
import { FirmwareLogKind } from '../../models/FirmwareLogKind';
import { FirmwarePhase } from '../../models/FirmwarePhase';
import type { FirmwareState } from '../../models/FirmwareState';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { CodeHighlighter } from './firmware/CodeHighlighter';
import { FirmwareControl } from './firmware/FirmwareControl';

/**
 * Pantalla de la laptop, dibujada en canvas: un IDE oscuro con barra de título, botón "Subir" y barra de
 * progreso, lista de programas a la izquierda, editor con el código resaltado (se desplaza solo si no cabe),
 * consola con la salida de la compilación y el monitor serie, y barra de estado con la lectura del
 * potenciómetro. Solo se redibuja cuando algo cambió y a lo sumo unas veces por segundo.
 */
export class LaptopScreen {
  public static readonly CANVAS = { width: 512, height: 384 };
  public static readonly UPLOAD = { x: 8, y: 22, width: 78, height: 20 };

  private static readonly PROGRAM = 'program-';
  private static readonly TITLE = { height: 18 };
  private static readonly TOOLBAR = {
    top: 18,
    height: 28,
    info: 100,
    bar: { x: 292, width: 210, height: 6 },
  };
  private static readonly SIDEBAR = { width: 118, header: 18, entry: 30, gap: 2, inset: 4 };
  private static readonly EDITOR = { top: 46, bottom: 272, tab: 16, gutter: 28, line: 11, pad: 4 };
  private static readonly CONSOLE = { top: 272, bottom: 366, header: 14, line: 11.5 };
  private static readonly STATUS = { top: 366, height: 18 };
  private static readonly FONT = { small: 9, body: 10, title: 10 };
  private static readonly WEIGHT = { regular: 400, bold: 700 };
  private static readonly SCROLL = { hold: 3.5, step: 0.45 };
  private static readonly MARGIN = 6;
  private static readonly DOTS = [{ color: '#ff5f57' }, { color: '#febc2e' }, { color: '#28c840' }];
  private static readonly DOT = { radius: 3.5, spacing: 11 };
  private static readonly COLORS = {
    title: '#15171c',
    toolbar: '#21252b',
    sidebar: '#181b21',
    editor: '#1e222a',
    gutter: '#4b5263',
    console: '#0f1115',
    border: '#2c313a',
    text: '#d7dae0',
    dim: '#7f848e',
    accent: '#00979c',
    accentHover: '#19c2c8',
    busy: '#3a4048',
    upload: '#c7801e',
    selected: '#2c313c',
    hover: '#262a33',
    track: '#2c313a',
    running: '#3ddc84',
  };
  private static readonly LOG_COLORS: Record<FirmwareLogKind, string> = {
    [FirmwareLogKind.Build]: '#d7dae0',
    [FirmwareLogKind.Boot]: '#7f848e',
    [FirmwareLogKind.Serial]: '#98c379',
    [FirmwareLogKind.Input]: '#61afef',
  };

  private readonly highlighter = new CodeHighlighter();
  private context: CanvasRenderingContext2D | null = null;
  private texture: CanvasTexture | null = null;
  private shown = '';
  private opened = { program: -1, at: 0 };

  /**
   * Crea la pantalla.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Zona de una entrada de la lista de programas, en píxeles del canvas.
   *
   * @param index Programa.
   * @returns Rectángulo.
   */
  public static program(index: number): { x: number; y: number; width: number; height: number } {
    const { width, header, entry, gap, inset } = LaptopScreen.SIDEBAR;
    return {
      x: inset,
      y: LaptopScreen.EDITOR.top + header + index * entry,
      width: width - inset * 2,
      height: entry - gap,
    };
  }

  /**
   * Id del control de una entrada de la lista de programas.
   *
   * @param index Programa.
   * @returns Id.
   */
  public static programId(index: number): string {
    return `${LaptopScreen.PROGRAM}${String(index)}`;
  }

  /**
   * Programa de un id `program-<índice>`.
   *
   * @param id Id del control.
   * @returns Índice, o -1 si no es una entrada de la lista.
   */
  public static programIndex(id: string): number {
    return id.startsWith(LaptopScreen.PROGRAM) ? Number(id.slice(LaptopScreen.PROGRAM.length)) : -1;
  }

  /**
   * Crea la textura (se redibuja sobre el mismo canvas).
   *
   * @returns Textura dinámica.
   */
  public create(): CanvasTexture {
    const { width, height } = LaptopScreen.CANVAS;
    this.texture = this.textures.paint(
      width,
      height,
      (context) => {
        this.context = context;
        context.textBaseline = 'middle';
      },
      1,
    );
    return this.texture;
  }

  /**
   * Redibuja la pantalla si cambió algo.
   *
   * @param state Estado del laboratorio.
   * @param hover Control señalado o `null`.
   * @param elapsed Segundos desde que empezó la escena.
   */
  public draw(state: FirmwareState, hover: string | null, elapsed: number): void {
    const context = this.context;
    if (!context || !this.texture) {
      return;
    }
    if (state.selected !== this.opened.program) {
      this.opened = { program: state.selected, at: elapsed };
    }
    const lines = state.programs[state.selected]?.source.length ?? 0;
    const scroll = this.scroll(lines, elapsed - this.opened.at);
    const key = `${String(state.revision)}|${hover ?? ''}|${String(scroll)}`;
    if (key === this.shown) {
      return;
    }
    this.shown = key;
    this.paint(context, state, hover, scroll);
    this.texture.needsUpdate = true;
  }

  /**
   * Pinta toda la pantalla.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   * @param hover Control señalado.
   * @param scroll Primera línea visible del editor.
   */
  private paint(
    context: CanvasRenderingContext2D,
    state: FirmwareState,
    hover: string | null,
    scroll: number,
  ): void {
    this.paintTitle(context, state);
    this.paintToolbar(context, state, hover);
    this.paintSidebar(context, state, hover);
    this.paintEditor(context, state, scroll);
    this.paintConsole(context, state);
    this.paintStatus(context, state);
  }

  /**
   * Barra de título con los tres botones de la ventana.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   */
  private paintTitle(context: CanvasRenderingContext2D, state: FirmwareState): void {
    const { width } = LaptopScreen.CANVAS;
    const { height } = LaptopScreen.TITLE;
    const { radius, spacing } = LaptopScreen.DOT;
    context.fillStyle = LaptopScreen.COLORS.title;
    context.fillRect(0, 0, width, height);
    LaptopScreen.DOTS.forEach(({ color }, index) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(LaptopScreen.MARGIN * 2 + index * spacing, height / 2, radius, 0, Math.PI * 2);
      context.fill();
    });
    const file = state.programs[state.selected]?.file ?? '';
    this.text(context, `${file} — Firmware Lab`, { x: width / 2, y: height / 2 }, { align: 'center' });
  }

  /**
   * Barra de herramientas: botón "Subir", placa y puerto, o el avance de la subida.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   * @param hover Control señalado.
   */
  private paintToolbar(context: CanvasRenderingContext2D, state: FirmwareState, hover: string | null): void {
    const { top, height, info } = LaptopScreen.TOOLBAR;
    const { COLORS } = LaptopScreen;
    context.fillStyle = COLORS.toolbar;
    context.fillRect(0, top, LaptopScreen.CANVAS.width, height);
    const busy = state.phase !== FirmwarePhase.Running;
    this.paintButton(context, busy, hover === FirmwareControl.Upload && !busy);
    if (busy) {
      this.paintProgress(context, state);
      return;
    }
    const board = 'ESP32 Dev Module · COM3 · 115200 baud';
    this.text(context, board, { x: info, y: top + height / 2 }, { color: COLORS.dim });
  }

  /**
   * Botón "Subir".
   *
   * @param context Contexto 2D.
   * @param busy Si hay una subida en curso.
   * @param hovered Si está señalado.
   */
  private paintButton(context: CanvasRenderingContext2D, busy: boolean, hovered: boolean): void {
    const button = LaptopScreen.UPLOAD;
    context.fillStyle = LaptopScreen.buttonColor(busy, hovered);
    context.fillRect(button.x, button.y, button.width, button.height);
    const center = { x: button.x + button.width / 2, y: button.y + button.height / 2 };
    const label = busy ? 'Subiendo…' : '➜  Subir';
    this.text(context, label, center, { align: 'center', weight: LaptopScreen.WEIGHT.bold });
  }

  /**
   * Avance de la subida en la barra de herramientas.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   */
  private paintProgress(context: CanvasRenderingContext2D, state: FirmwareState): void {
    const { top, height, info, bar } = LaptopScreen.TOOLBAR;
    const { COLORS } = LaptopScreen;
    const y = top + height / 2;
    this.text(
      context,
      state.label,
      { x: info, y },
      { weight: LaptopScreen.WEIGHT.bold, color: COLORS.upload },
    );
    context.fillStyle = COLORS.track;
    context.fillRect(bar.x, y - bar.height / 2, bar.width, bar.height);
    context.fillStyle = COLORS.upload;
    context.fillRect(bar.x, y - bar.height / 2, bar.width * state.progress, bar.height);
  }

  /**
   * Lista de programas.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   * @param hover Control señalado.
   */
  private paintSidebar(context: CanvasRenderingContext2D, state: FirmwareState, hover: string | null): void {
    const { width, header } = LaptopScreen.SIDEBAR;
    const { top } = LaptopScreen.EDITOR;
    context.fillStyle = LaptopScreen.COLORS.sidebar;
    context.fillRect(0, top, width, LaptopScreen.CONSOLE.top - top);
    const title = { x: LaptopScreen.MARGIN, y: top + header / 2 };
    this.text(context, 'PROGRAMAS', title, {
      weight: LaptopScreen.WEIGHT.bold,
      color: LaptopScreen.COLORS.dim,
    });
    state.programs.forEach((program, index) => {
      const selected = index === state.selected;
      const hovered = hover === LaptopScreen.programId(index);
      this.paintEntry(context, index, { name: program.name, file: program.file }, { selected, hovered });
      if (index === state.running) {
        this.paintRunning(context, index);
      }
    });
  }

  /**
   * Una entrada de la lista.
   *
   * @param context Contexto 2D.
   * @param index Programa.
   * @param labels Nombre y archivo.
   * @param labels.name Nombre.
   * @param labels.file Archivo.
   * @param look Si está abierta o señalada.
   * @param look.selected Si está abierta en el editor.
   * @param look.hovered Si está señalada.
   */
  private paintEntry(
    context: CanvasRenderingContext2D,
    index: number,
    labels: { name: string; file: string },
    look: { selected: boolean; hovered: boolean },
  ): void {
    const { COLORS, MARGIN, WEIGHT, FONT } = LaptopScreen;
    const rect = LaptopScreen.program(index);
    if (look.selected || look.hovered) {
      context.fillStyle = look.selected ? COLORS.selected : COLORS.hover;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    context.fillStyle = look.selected ? COLORS.accent : 'transparent';
    context.fillRect(rect.x, rect.y, 2, rect.height);
    const x = rect.x + MARGIN;
    this.text(context, labels.name, { x, y: rect.y + rect.height / 3 }, { weight: WEIGHT.bold });
    const file = { x, y: rect.y + (rect.height * 2) / 3 };
    this.text(context, labels.file, file, { color: COLORS.dim, size: FONT.small });
  }

  /**
   * Marca del programa que corre en la placa.
   *
   * @param context Contexto 2D.
   * @param index Programa.
   */
  private paintRunning(context: CanvasRenderingContext2D, index: number): void {
    const rect = LaptopScreen.program(index);
    const x = rect.x + rect.width - LaptopScreen.MARGIN;
    context.fillStyle = LaptopScreen.COLORS.running;
    context.beginPath();
    context.arc(x, rect.y + rect.height / 3, LaptopScreen.DOT.radius, 0, Math.PI * 2);
    context.fill();
  }

  /**
   * Editor: pestaña del archivo, números de línea y código resaltado.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   * @param scroll Primera línea visible.
   */
  private paintEditor(context: CanvasRenderingContext2D, state: FirmwareState, scroll: number): void {
    const { top, bottom, tab } = LaptopScreen.EDITOR;
    const left = LaptopScreen.SIDEBAR.width;
    const { COLORS } = LaptopScreen;
    context.fillStyle = COLORS.editor;
    context.fillRect(left, top, LaptopScreen.CANVAS.width - left, bottom - top);
    context.fillStyle = COLORS.toolbar;
    context.fillRect(left, top, LaptopScreen.CANVAS.width - left, tab);
    const program = state.programs[state.selected];
    if (!program) {
      return;
    }
    const label = { x: left + LaptopScreen.MARGIN * 2, y: top + tab / 2 };
    this.text(context, program.file, label, { weight: LaptopScreen.WEIGHT.bold });
    const visible = program.source.slice(scroll, scroll + LaptopScreen.visibleLines());
    visible.forEach((line, row) => {
      this.paintLine(context, line, scroll + row, row);
    });
  }

  /**
   * Una línea del editor con su número.
   *
   * @param context Contexto 2D.
   * @param line Código.
   * @param number Índice de la línea en el archivo.
   * @param row Fila en pantalla.
   */
  private paintLine(context: CanvasRenderingContext2D, line: string, number: number, row: number): void {
    const { top, tab, gutter, line: height, pad } = LaptopScreen.EDITOR;
    const left = LaptopScreen.SIDEBAR.width;
    const y = top + tab + pad + height * (row + 0.5);
    const gutterX = left + gutter - LaptopScreen.MARGIN;
    const gutterAt = { x: gutterX, y };
    this.text(context, String(number + 1), gutterAt, { align: 'right', color: LaptopScreen.COLORS.gutter });
    this.paintCode(context, line, { x: left + gutter, y });
  }

  /**
   * Código de una línea, trozo por trozo con su color.
   *
   * @param context Contexto 2D.
   * @param line Código.
   * @param at Comienzo de la línea.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   */
  private paintCode(context: CanvasRenderingContext2D, line: string, at: { x: number; y: number }): void {
    context.font = LaptopScreen.font(LaptopScreen.WEIGHT.regular, LaptopScreen.FONT.body);
    context.textAlign = 'left';
    let x = at.x;
    this.highlighter.tokens(line).forEach((token) => {
      context.fillStyle = token.color;
      context.fillText(token.text, x, at.y);
      x += context.measureText(token.text).width;
    });
  }

  /**
   * Consola: salida de la compilación o monitor serie.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   */
  private paintConsole(context: CanvasRenderingContext2D, state: FirmwareState): void {
    const { top, bottom, header, line } = LaptopScreen.CONSOLE;
    const { COLORS, MARGIN, WEIGHT } = LaptopScreen;
    context.fillStyle = COLORS.console;
    context.fillRect(0, top, LaptopScreen.CANVAS.width, bottom - top);
    context.fillStyle = COLORS.border;
    context.fillRect(0, top, LaptopScreen.CANVAS.width, 1);
    const building = state.phase !== FirmwarePhase.Running;
    const title = building ? 'SALIDA · compilación y subida' : 'MONITOR SERIE · 115200 baud';
    this.text(context, title, { x: MARGIN, y: top + header / 2 }, { weight: WEIGHT.bold, color: COLORS.dim });
    state.log.forEach((entry, index) => {
      const y = top + header + line * (index + 0.5);
      const color = LaptopScreen.LOG_COLORS[entry.kind];
      this.text(context, entry.text, { x: MARGIN, y }, { color });
    });
  }

  /**
   * Barra de estado: qué hace la placa y la lectura del potenciómetro.
   *
   * @param context Contexto 2D.
   * @param state Estado del laboratorio.
   */
  private paintStatus(context: CanvasRenderingContext2D, state: FirmwareState): void {
    const { top, height } = LaptopScreen.STATUS;
    const { width } = LaptopScreen.CANVAS;
    const building = state.phase !== FirmwarePhase.Running;
    context.fillStyle = building ? LaptopScreen.COLORS.upload : LaptopScreen.COLORS.accent;
    context.fillRect(0, top, width, height);
    const y = top + height / 2;
    this.text(
      context,
      `● ${state.label}`,
      { x: LaptopScreen.MARGIN, y },
      { weight: LaptopScreen.WEIGHT.bold },
    );
    const pot = `POT ${String(state.pot)} / 4095 · delay ${String(state.delay)} ms`;
    this.text(context, pot, { x: width - LaptopScreen.MARGIN, y }, { align: 'right' });
  }

  /**
   * Primera línea visible del editor: si el código no cabe, baja y sube despacio con pausas en los extremos.
   *
   * @param lines Líneas del programa.
   * @param time Segundos desde que se abrió.
   * @returns Índice de la primera línea visible.
   */
  private scroll(lines: number, time: number): number {
    const extra = lines - LaptopScreen.visibleLines();
    if (extra <= 0) {
      return 0;
    }
    const { hold, step } = LaptopScreen.SCROLL;
    const travel = extra * step;
    const t = time % (2 * (hold + travel));
    if (t < hold) {
      return 0;
    }
    if (t < hold + travel) {
      return Math.floor((t - hold) / step);
    }
    return t < 2 * hold + travel ? extra : extra - Math.floor((t - 2 * hold - travel) / step);
  }

  /**
   * Escribe un texto de una línea.
   *
   * @param context Contexto 2D.
   * @param text Texto.
   * @param at Punto de anclaje.
   * @param at.x Horizontal.
   * @param at.y Vertical (centro de la línea).
   * @param style Alineación, grosor, color y tamaño (por omisión: izquierda, normal, claro, cuerpo).
   * @param style.align Alineación.
   * @param style.weight Grosor.
   * @param style.color Color.
   * @param style.size Tamaño.
   */
  private text(
    context: CanvasRenderingContext2D,
    text: string,
    at: { x: number; y: number },
    style: { align?: CanvasTextAlign; weight?: number; color?: string; size?: number } = {},
  ): void {
    const { WEIGHT, COLORS, FONT } = LaptopScreen;
    context.font = LaptopScreen.font(style.weight ?? WEIGHT.regular, style.size ?? FONT.body);
    context.textAlign = style.align ?? 'left';
    context.fillStyle = style.color ?? COLORS.text;
    context.fillText(text, at.x, at.y);
  }

  /**
   * Color del botón "Subir".
   *
   * @param busy Si hay una subida en curso.
   * @param hovered Si está señalado.
   * @returns Color CSS.
   */
  private static buttonColor(busy: boolean, hovered: boolean): string {
    const { COLORS } = LaptopScreen;
    if (busy) {
      return COLORS.busy;
    }
    return hovered ? COLORS.accentHover : COLORS.accent;
  }

  /**
   * Líneas de código que caben en el editor.
   *
   * @returns Cantidad de líneas.
   */
  private static visibleLines(): number {
    const { top, bottom, tab, line, pad } = LaptopScreen.EDITOR;
    return Math.floor((bottom - top - tab - pad * 2) / line);
  }

  /**
   * Fuente monoespaciada del IDE.
   *
   * @param weight Grosor.
   * @param size Tamaño.
   * @returns Fuente CSS.
   */
  private static font(weight: number, size: number): string {
    return `${String(weight)} ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
  }
}
