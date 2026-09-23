import type { Texture } from 'three';
import type { PlateView } from '../../models/PlateView';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { PanelLayout } from './PanelLayout';

/**
 * Gráficas del tablero del poste dibujadas en canvas: el diagrama unifilar del fondo (bus, etapas, carga
 * final, tira de etiquetas y estado del circuito), los sellos de inspección de la puerta, la placa de
 * advertencia y la carátula del medidor de energía. El diagrama se redibuja solo cuando la corriente llega a
 * otro nodo, nunca cada frame.
 */
export class BreakerPanelArt {
  private static readonly LAYOUT = new PanelLayout();
  private static readonly SCALE = 500;
  private static readonly DETAIL = 2;
  private static readonly WEIGHT = 700;
  private static readonly COLORS = {
    background: '#1a2226',
    border: '#2e3b40',
    dead: '#34454c',
    live: '#5ff3ff',
    halo: 'rgba(95, 243, 255, 0.22)',
    node: '#10181b',
    liveNode: '#0d3940',
    selected: '#ffb347',
    text: '#c9d6db',
    dim: '#6d7f86',
    paper: '#ece6d2',
    ink: '#1d2326',
  };
  private static readonly LINE = { dead: 2, live: 2.5, halo: 7, node: 1.5, selected: 2.5, radius: 4 };
  private static readonly TEXT = { title: 11, node: 9, strip: 9, status: 10, hint: 8, symbol: 13 };
  private static readonly TENTHS = 10;
  private static readonly STRIP_HEIGHT = 0.028;
  private static readonly MARGIN = 0.016;
  private static readonly STATUS = {
    dead: { text: 'SIN ENERGÍA · SUBE EL MAIN', color: '#ff5a5a' },
    open: { text: '○ CIRCUITO ABIERTO · SUBE ', color: '#ffb347' },
    closed: { text: '● CIRCUITO CERRADO · PRESENTE EN LÍNEA', color: '#6dff9e' },
  };
  private static readonly TITLE = { text: 'TABLERO · TRAYECTORIA', mark: '分電盤' };
  private static readonly HINT = '▲ ON    ▼ OFF    LA CORRIENTE VA EN SERIE →';
  private static readonly SEALS = {
    width: 0.58,
    height: 0.74,
    background: '#56636a',
    columns: [{ x: -0.12 }, { x: 0.12 }],
    top: 0.07,
    step: 0.15,
    radius: 0.055,
    colors: ['#e8c547', '#3fd8ff', '#ff5c8a', '#7dff9e'],
    issuer: 13,
    year: 11,
    caption: { text: 'INSPECCIONADO', size: 4.5, y: 0.028 },
    title: { text: 'CERTIFICACIONES', size: 12, y: 0.25 },
    rule: { y: 0.215, width: 0.4 },
  };
  private static readonly WARNING = {
    width: 0.16,
    height: 0.1,
    scale: 800,
    background: '#f2c230',
    ink: '#141414',
    border: 3,
    symbol: { text: '⚡ 危険', size: 20, y: 0.36 },
    caption: { text: 'ALTA TENSIÓN', size: 12, y: 0.74 },
  };
  private static readonly METER = {
    size: 0.16,
    scale: 1000,
    background: '#efe9d8',
    ink: '#1d2326',
    brand: { text: 'MEDIDOR · EXP', size: 11, y: 0.2 },
    unit: { text: 'AÑOS DE EXPERIENCIA', size: 8, y: 0.52 },
    note: { text: '1 rev = 1 día', size: 7, y: 0.86 },
    digits: { count: 5, width: 16, height: 22, gap: 2, y: 0.36, size: 16, box: '#20262a', last: '#b8322c' },
  };

  /**
   * Crea el set de gráficas.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Diagrama unifilar del fondo del tablero.
   *
   * @param view Etapas, hasta dónde llega la corriente y etapa elegida.
   * @returns Textura del fondo.
   */
  public plate(view: PlateView): Texture {
    const { width, height } = PanelLayout.PLATE;
    return this.paint(width, height, BreakerPanelArt.SCALE, (context) => {
      BreakerPanelArt.background(context);
      BreakerPanelArt.bus(context, view);
      BreakerPanelArt.nodes(context, view);
      BreakerPanelArt.strip(context, view.labels);
      BreakerPanelArt.status(context, view);
    });
  }

  /**
   * Cara interna de la puerta: título y un sello de inspección redondo por certificación.
   *
   * @param seals Texto de cada sello ("NVIDIA 2022").
   * @returns Textura de la cara interna.
   */
  public seals(seals: readonly string[]): Texture {
    const { width, height, background } = BreakerPanelArt.SEALS;
    return this.paint(width, height, BreakerPanelArt.SCALE, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, width * BreakerPanelArt.SCALE, height * BreakerPanelArt.SCALE);
      BreakerPanelArt.sealTitle(context);
      seals.forEach((seal, index) => {
        BreakerPanelArt.seal(context, seal, index);
      });
    });
  }

  /**
   * Placa amarilla de advertencia del frente de la puerta.
   *
   * @returns Textura de la placa.
   */
  public warning(): Texture {
    const { width, height, scale, background, ink, border, symbol, caption } = BreakerPanelArt.WARNING;
    const pixels = { width: width * scale, height: height * scale };
    return this.paint(width, height, scale, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, pixels.width, pixels.height);
      context.strokeStyle = ink;
      context.lineWidth = border;
      context.strokeRect(border, border, pixels.width - border * 2, pixels.height - border * 2);
      context.fillStyle = ink;
      BreakerPanelArt.write(context, symbol.text, symbol.size, {
        x: pixels.width / 2,
        y: pixels.height * symbol.y,
      });
      BreakerPanelArt.write(context, caption.text, caption.size, {
        x: pixels.width / 2,
        y: pixels.height * caption.y,
      });
    });
  }

  /**
   * Carátula del medidor: marca, contador de rodillos con los años de experiencia y unidad.
   *
   * @param years Años de experiencia.
   * @returns Textura de la carátula.
   */
  public meter(years: number): Texture {
    const { size, scale, background, ink, brand, unit, note } = BreakerPanelArt.METER;
    const pixels = size * scale;
    return this.paint(size, size, scale, (context) => {
      context.fillStyle = background;
      context.beginPath();
      context.arc(pixels / 2, pixels / 2, pixels / 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = ink;
      [brand, unit, note].forEach(({ text, size: font, y }) => {
        BreakerPanelArt.write(context, text, font, { x: pixels / 2, y: pixels * y });
      });
      BreakerPanelArt.odometer(context, years, pixels);
    });
  }

  /**
   * Pinta con más resolución que el resto del puesto (el tablero se ve de cerca).
   *
   * @param width Ancho en metros.
   * @param height Alto en metros.
   * @param scale Píxeles lógicos por metro.
   * @param draw Función de dibujo en píxeles lógicos.
   * @returns Textura.
   */
  private paint(
    width: number,
    height: number,
    scale: number,
    draw: (context: CanvasRenderingContext2D) => void,
  ): Texture {
    const detail = BreakerPanelArt.DETAIL;
    return this.textures.paint(width * scale * detail, height * scale * detail, (context) => {
      context.scale(detail, detail);
      draw(context);
    });
  }

  /**
   * Punto del tablero (metros desde el centro, +y arriba) en píxeles lógicos del diagrama.
   *
   * @param x Horizontal.
   * @param y Vertical.
   * @returns Punto en el canvas.
   */
  private static place(x: number, y: number): { x: number; y: number } {
    const { width, height } = PanelLayout.PLATE;
    const scale = BreakerPanelArt.SCALE;
    return { x: (x + width / 2) * scale, y: (height / 2 - y) * scale };
  }

  /**
   * Fondo pintado con borde y título.
   *
   * @param context Contexto de dibujo.
   */
  private static background(context: CanvasRenderingContext2D): void {
    const { width, height } = PanelLayout.PLATE;
    const { background, border, text } = BreakerPanelArt.COLORS;
    const scale = BreakerPanelArt.SCALE;
    const margin = BreakerPanelArt.MARGIN * scale;
    context.fillStyle = background;
    context.fillRect(0, 0, width * scale, height * scale);
    context.strokeStyle = border;
    context.lineWidth = BreakerPanelArt.LINE.node;
    context.strokeRect(margin, margin, width * scale - margin * 2, height * scale - margin * 2);
    context.fillStyle = text;
    const title = BreakerPanelArt.place(0, PanelLayout.TITLE_Y);
    const { text: label, mark } = BreakerPanelArt.TITLE;
    BreakerPanelArt.write(context, `${mark}  ${label}`, BreakerPanelArt.TEXT.title, title);
  }

  /**
   * Bus horizontal entre nodos y bajadas hacia cada breaker; lo energizado brilla en cian.
   *
   * @param context Contexto de dibujo.
   * @param view Estado del diagrama.
   */
  private static bus(context: CanvasRenderingContext2D, view: PlateView): void {
    const nodes = BreakerPanelArt.LAYOUT.path(view.labels.length);
    const busY = PanelLayout.BUS_Y;
    nodes.slice(1).forEach((x, index) => {
      const from = nodes[index] ?? x;
      BreakerPanelArt.wire(context, { x: from, y: busY }, { x, y: busY }, view.lit > index);
    });
    const top = PanelLayout.BREAKER.y + PanelLayout.BREAKER.height / 2;
    const drop = busY - PanelLayout.NODE.height / 2;
    nodes.slice(0, -1).forEach((x, index) => {
      BreakerPanelArt.wire(context, { x, y: drop }, { x, y: top }, view.lit >= index);
    });
  }

  /**
   * Un tramo de cable del diagrama: gris sin corriente, cian con un halo cuando está energizado.
   *
   * @param context Contexto de dibujo.
   * @param from Extremo inicial en metros.
   * @param from.x Horizontal.
   * @param from.y Vertical.
   * @param to Extremo final en metros.
   * @param to.x Horizontal.
   * @param to.y Vertical.
   * @param live Si lleva corriente.
   */
  private static wire(
    context: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    live: boolean,
  ): void {
    const start = BreakerPanelArt.place(from.x, from.y);
    const end = BreakerPanelArt.place(to.x, to.y);
    BreakerPanelArt.strokes(live).forEach(({ color, width }) => {
      context.strokeStyle = color;
      context.lineWidth = width;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    });
  }

  /**
   * Pasadas de trazo de un cable: una gris sin corriente; halo y núcleo cian con corriente.
   *
   * @param live Si lleva corriente.
   * @returns Color y grosor de cada pasada.
   */
  private static strokes(live: boolean): { color: string; width: number }[] {
    const { dead, live: liveColor, halo } = BreakerPanelArt.COLORS;
    const line = BreakerPanelArt.LINE;
    if (!live) {
      return [{ color: dead, width: line.dead }];
    }
    return [
      { color: halo, width: line.halo },
      { color: liveColor, width: line.live },
    ];
  }

  /**
   * Nodos del bus: la fuente (~), un bloque por etapa con su etiqueta y la carga final (⊗ HOY).
   *
   * @param context Contexto de dibujo.
   * @param view Estado del diagrama.
   */
  private static nodes(context: CanvasRenderingContext2D, view: PlateView): void {
    const nodes = BreakerPanelArt.LAYOUT.path(view.labels.length);
    const texts = ['~', ...view.labels, '⊗'];
    nodes.forEach((x, index) => {
      const selected = index === view.selected + 1;
      BreakerPanelArt.node(context, { x, text: texts[index] ?? '' }, view.lit >= index, selected);
    });
    const load = PanelLayout.LOAD;
    context.fillStyle = BreakerPanelArt.COLORS.dim;
    const below = BreakerPanelArt.place(load.x, PanelLayout.BUS_Y - PanelLayout.NODE.height);
    BreakerPanelArt.write(context, 'HOY', BreakerPanelArt.TEXT.node, below);
  }

  /**
   * Traza el contorno redondeado de un nodo del bus.
   *
   * @param context Contexto de dibujo.
   * @param x Posición horizontal en metros.
   */
  private static nodeShape(context: CanvasRenderingContext2D, x: number): void {
    const { width, height } = PanelLayout.NODE;
    const scale = BreakerPanelArt.SCALE;
    const corner = BreakerPanelArt.place(x - width / 2, PanelLayout.BUS_Y + height / 2);
    context.beginPath();
    context.roundRect(corner.x, corner.y, width * scale, height * scale, BreakerPanelArt.LINE.radius);
  }

  /**
   * Un nodo: bloque redondeado con su texto, relleno cuando llega corriente y remarcado si está elegido.
   *
   * @param context Contexto de dibujo.
   * @param node Posición horizontal y texto.
   * @param node.x Posición horizontal en metros.
   * @param node.text Texto del bloque.
   * @param live Si le llega corriente.
   * @param selected Si es la etapa elegida.
   */
  private static node(
    context: CanvasRenderingContext2D,
    node: { x: number; text: string },
    live: boolean,
    selected: boolean,
  ): void {
    const colors = BreakerPanelArt.COLORS;
    BreakerPanelArt.nodeShape(context, node.x);
    context.fillStyle = live ? colors.liveNode : colors.node;
    context.fill();
    const outline = live ? colors.live : colors.dead;
    context.strokeStyle = selected ? colors.selected : outline;
    context.lineWidth = selected ? BreakerPanelArt.LINE.selected : BreakerPanelArt.LINE.node;
    context.stroke();
    context.fillStyle = live ? colors.live : colors.text;
    const center = BreakerPanelArt.place(node.x, PanelLayout.BUS_Y);
    BreakerPanelArt.write(context, node.text, BreakerPanelArt.TEXT.node, center);
  }

  /**
   * Tira de papel bajo los breakers con la etiqueta escrita de cada uno.
   *
   * @param context Contexto de dibujo.
   * @param labels Etiqueta de cada etapa.
   */
  private static strip(context: CanvasRenderingContext2D, labels: readonly string[]): void {
    const { paper, ink } = BreakerPanelArt.COLORS;
    const scale = BreakerPanelArt.SCALE;
    const left = PanelLayout.MAIN.x - PanelLayout.MAIN.width / 2;
    const right = PanelLayout.SLOTS.last + PanelLayout.BREAKER.width / 2;
    const height = BreakerPanelArt.STRIP_HEIGHT;
    const corner = BreakerPanelArt.place(left, PanelLayout.LABEL_Y + height / 2);
    context.fillStyle = paper;
    context.fillRect(corner.x, corner.y, (right - left) * scale, height * scale);
    context.fillStyle = ink;
    const names = ['MAIN', ...labels];
    BreakerPanelArt.LAYOUT.path(labels.length)
      .slice(0, -1)
      .forEach((x, index) => {
        const at = BreakerPanelArt.place(x, PanelLayout.LABEL_Y);
        BreakerPanelArt.write(context, names[index] ?? '', BreakerPanelArt.TEXT.strip, at);
      });
  }

  /**
   * Estado del circuito (sin energía, abierto o cerrado) y la ayuda de uso.
   *
   * @param context Contexto de dibujo.
   * @param view Estado del diagrama.
   */
  private static status(context: CanvasRenderingContext2D, view: PlateView): void {
    const state = BreakerPanelArt.statusOf(view);
    context.fillStyle = state.color;
    BreakerPanelArt.write(
      context,
      state.text,
      BreakerPanelArt.TEXT.status,
      BreakerPanelArt.place(0, PanelLayout.STATUS_Y),
    );
    context.fillStyle = BreakerPanelArt.COLORS.dim;
    BreakerPanelArt.write(
      context,
      BreakerPanelArt.HINT,
      BreakerPanelArt.TEXT.hint,
      BreakerPanelArt.place(0, PanelLayout.HINT_Y),
    );
  }

  /**
   * Texto y color del estado del circuito.
   *
   * @param view Estado del diagrama.
   * @returns Texto y color.
   */
  private static statusOf(view: PlateView): { text: string; color: string } {
    const { dead, open, closed } = BreakerPanelArt.STATUS;
    if (view.lit < 0) {
      return dead;
    }
    if (view.lit > view.labels.length) {
      return closed;
    }
    return { ...open, text: open.text + (view.labels[view.lit] ?? '') };
  }

  /**
   * Título de la cara interna de la puerta con una raya debajo.
   *
   * @param context Contexto de dibujo.
   */
  private static sealTitle(context: CanvasRenderingContext2D): void {
    const { title, rule } = BreakerPanelArt.SEALS;
    context.fillStyle = BreakerPanelArt.COLORS.paper;
    BreakerPanelArt.write(context, title.text, title.size, BreakerPanelArt.place(0, title.y));
    const start = BreakerPanelArt.place(-rule.width / 2, rule.y);
    context.fillRect(start.x, start.y, rule.width * BreakerPanelArt.SCALE, 1);
  }

  /**
   * Un sello redondo de inspección: anillo de color, emisor y año.
   *
   * @param context Contexto de dibujo.
   * @param text Texto del sello ("NVIDIA 2022"): la última palabra es el año.
   * @param index Posición del sello.
   */
  private static seal(context: CanvasRenderingContext2D, text: string, index: number): void {
    const { columns, top, step, radius, colors, issuer, year, caption } = BreakerPanelArt.SEALS;
    const column = columns[index % columns.length]?.x ?? 0;
    const row = Math.floor(index / columns.length);
    const center = BreakerPanelArt.place(column, top - row * step);
    const words = text.split(' ');
    context.fillStyle = colors[index % colors.length] ?? BreakerPanelArt.COLORS.paper;
    context.beginPath();
    context.arc(center.x, center.y, radius * BreakerPanelArt.SCALE, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = BreakerPanelArt.COLORS.ink;
    const offset = caption.y * BreakerPanelArt.SCALE;
    BreakerPanelArt.write(context, caption.text, caption.size, { x: center.x, y: center.y - offset });
    BreakerPanelArt.write(context, words.slice(0, -1).join(' '), issuer, center);
    BreakerPanelArt.write(context, words.at(-1) ?? '', year, { x: center.x, y: center.y + offset });
  }

  /**
   * Contador de rodillos: años con un decimal, el último rodillo en rojo.
   *
   * @param context Contexto de dibujo.
   * @param years Años.
   * @param pixels Lado de la carátula en píxeles lógicos.
   */
  private static odometer(context: CanvasRenderingContext2D, years: number, pixels: number): void {
    const { count, width, height, gap, y, size, box, last } = BreakerPanelArt.METER.digits;
    const digits = Math.round(years * BreakerPanelArt.TENTHS)
      .toString()
      .padStart(count, '0')
      .slice(-count);
    const left = pixels / 2 - (count * width + (count - 1) * gap) / 2;
    Array.from({ length: count }, (_, index) => digits.charAt(index)).forEach((digit, index) => {
      const x = left + index * (width + gap);
      context.fillStyle = index === count - 1 ? last : box;
      context.fillRect(x, pixels * y - height / 2, width, height);
      context.fillStyle = BreakerPanelArt.METER.background;
      BreakerPanelArt.write(context, digit, size, { x: x + width / 2, y: pixels * y });
    });
  }

  /**
   * Escribe un texto centrado en letra monoespaciada gruesa.
   *
   * @param context Contexto de dibujo.
   * @param text Texto.
   * @param size Tamaño en píxeles lógicos.
   * @param at Centro del texto.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   */
  private static write(
    context: CanvasRenderingContext2D,
    text: string,
    size: number,
    at: { x: number; y: number },
  ): void {
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `${String(BreakerPanelArt.WEIGHT)} ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(text, at.x, at.y);
  }
}
