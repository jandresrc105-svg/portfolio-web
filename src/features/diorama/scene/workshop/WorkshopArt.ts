import type { CanvasTexture } from 'three';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Gráficas fijas del taller dibujadas en canvas: el tablero perforado, los cajoncitos de componentes, la
 * protoboard y la cara de cada placa de proyecto (máscara de soldadura, pistas, pads y serigrafía). Se
 * dibujan una sola vez.
 */
export class WorkshopArt {
  private static readonly PEGBOARD = {
    width: 468,
    height: 276,
    color: '#5a3d27',
    hole: '#1b120c',
    step: 18,
    radius: 2.6,
  };
  private static readonly DRAWERS = {
    width: 272,
    height: 208,
    columns: 4,
    rows: 5,
    frame: '#20252c',
    front: '#9fc3de',
    label: '#f3f5f7',
    ink: '#1a2027',
    gap: 5,
    font: 13,
    band: 1.4,
  };
  private static readonly PARTS = [
    '1kΩ',
    '10kΩ',
    '100nF',
    '10µF',
    'LED',
    '555',
    'LM358',
    'BC547',
    '1N4148',
    '7805',
    'ESP32',
    'HC-05',
    'DHT22',
    'SG90',
    'PINES',
    'USB',
    'XTAL',
    'FUSIBLE',
    'RELÉ',
    'ZENER',
  ];
  private static readonly BREADBOARD = {
    width: 200,
    height: 70,
    body: '#bdb8ab',
    hole: '#3b3a36',
    step: 6.5,
    size: 2.4,
    channel: 5,
    rail: 7,
  };
  private static readonly RAILS = [
    { from: 'top', offset: 2, color: '#d8343a' },
    { from: 'top', offset: 14, color: '#2f5fd0' },
    { from: 'bottom', offset: 14, color: '#d8343a' },
    { from: 'bottom', offset: 2, color: '#2f5fd0' },
  ];
  private static readonly BOARD = {
    width: 300,
    height: 200,
    masks: ['#1d6b3a', '#1b3f8a', '#1c1c22', '#5a2a86'],
    copper: 'rgba(255, 255, 255, 0.16)',
    pad: '#d9b45a',
    silk: '#f2f2ea',
    margin: 10,
    hole: 7,
    traces: 9,
    label: 22,
    caption: 11,
    trace: 3,
    reach: 0.5,
    bend: 0.1,
    lineGap: 1.6,
  };
  private static readonly HASH = { a: 12.9898, b: 78.233, scale: 43758.5453 };

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Tablero perforado de la pared del fondo.
   *
   * @returns Textura.
   */
  public pegboard(): CanvasTexture {
    const { width, height, color } = WorkshopArt.PEGBOARD;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      WorkshopArt.perforate(context);
    });
  }

  /**
   * Frente del gabinete de cajoncitos, cada uno con la etiqueta de su componente.
   *
   * @returns Textura.
   */
  public drawers(): CanvasTexture {
    const { width, height, columns, rows, frame } = WorkshopArt.DRAWERS;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = frame;
      context.fillRect(0, 0, width, height);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      for (let index = 0; index < columns * rows; index += 1) {
        WorkshopArt.drawer(context, index, { x: width / columns, y: height / rows });
      }
    });
  }

  /**
   * Protoboard: dos bloques de agujeros separados por el canal central y los rieles de alimentación.
   *
   * @returns Textura.
   */
  public breadboard(): CanvasTexture {
    const { width, height, body } = WorkshopArt.BREADBOARD;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = body;
      context.fillRect(0, 0, width, height);
      WorkshopArt.rails(context);
      WorkshopArt.holes(context);
    });
  }

  /**
   * Cara de una placa de proyecto: máscara de su color, pistas, pads, agujeros de montaje y su nombre
   * serigrafiado.
   *
   * @param label Nombre serigrafiado.
   * @param index Índice de la placa (elige el color y el trazado de las pistas).
   * @returns Textura.
   */
  public board(label: string, index: number): CanvasTexture {
    const { width, height, masks } = WorkshopArt.BOARD;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = masks[index % masks.length] ?? '#1d6b3a';
      context.fillRect(0, 0, width, height);
      WorkshopArt.traces(context, index);
      WorkshopArt.mountingHoles(context);
      WorkshopArt.silkscreen(context, label, index);
    });
  }

  /**
   * Agujeros del tablero perforado en cuadrícula.
   *
   * @param context Contexto 2D.
   */
  private static perforate(context: CanvasRenderingContext2D): void {
    const { width, height, hole, step, radius } = WorkshopArt.PEGBOARD;
    context.fillStyle = hole;
    for (let y = step / 2; y < height; y += step) {
      for (let x = step / 2; x < width; x += step) {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  /**
   * Un cajoncito del gabinete con su etiqueta.
   *
   * @param context Contexto 2D.
   * @param index Índice del cajón (en orden de lectura).
   * @param cell Tamaño de cada celda.
   * @param cell.x Ancho.
   * @param cell.y Alto.
   */
  private static drawer(
    context: CanvasRenderingContext2D,
    index: number,
    cell: { x: number; y: number },
  ): void {
    const { columns, front, label, ink, gap, font, band } = WorkshopArt.DRAWERS;
    const x = (index % columns) * cell.x;
    const y = Math.floor(index / columns) * cell.y;
    context.fillStyle = front;
    context.fillRect(x + gap, y + gap, cell.x - gap * 2, cell.y - gap * 2);
    context.fillStyle = label;
    context.fillRect(x + gap * 2, y + (cell.y - font * band) / 2, cell.x - gap * 2 * 2, font * band);
    context.fillStyle = ink;
    context.font = `700 ${String(font)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(WorkshopArt.PARTS[index] ?? '', x + cell.x / 2, y + cell.y / 2);
  }

  /**
   * Rieles de alimentación de la protoboard (rojo = +, azul = −) arriba y abajo.
   *
   * @param context Contexto 2D.
   */
  private static rails(context: CanvasRenderingContext2D): void {
    const { width, height } = WorkshopArt.BREADBOARD;
    context.lineWidth = 1;
    WorkshopArt.RAILS.forEach(({ from, offset, color }) => {
      const y = from === 'top' ? offset : height - offset;
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    });
  }

  /**
   * Agujeros de la protoboard: filas de los rieles y los dos bloques de cinco a cada lado del canal.
   *
   * @param context Contexto 2D.
   */
  private static holes(context: CanvasRenderingContext2D): void {
    const { width, height, hole, step, size, channel, rail } = WorkshopArt.BREADBOARD;
    const rows = [rail, height - rail];
    for (let row = 0; row < channel; row += 1) {
      rows.push(height / 2 - channel / 2 - (row + 1) * step, height / 2 + channel / 2 + (row + 1) * step);
    }
    context.fillStyle = hole;
    rows.forEach((y) => {
      for (let x = step; x < width - step / 2; x += step) {
        context.fillRect(x - size / 2, y - size / 2, size, size);
      }
    });
  }

  /**
   * Pistas de cobre bajo la máscara: tramos rectos con un quiebre a 45°, terminados en un pad.
   *
   * @param context Contexto 2D.
   * @param index Índice de la placa (semilla del trazado).
   */
  private static traces(context: CanvasRenderingContext2D, index: number): void {
    const { width, height, copper, pad, traces, trace, reach, bend } = WorkshopArt.BOARD;
    context.lineWidth = trace;
    for (let line = 0; line < traces; line += 1) {
      const x = WorkshopArt.hash(index, line) * width;
      const y = WorkshopArt.hash(line, index + 1) * height;
      const end = {
        x: x + WorkshopArt.hash(index + line, 2) * width * reach + height * bend,
        y: y + height * bend,
      };
      context.strokeStyle = copper;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(end.x - height * bend, y);
      context.lineTo(end.x, end.y);
      context.stroke();
      context.fillStyle = pad;
      context.fillRect(end.x - trace, end.y - trace, trace * 2, trace * 2);
    }
  }

  /**
   * Agujeros de montaje dorados en las cuatro esquinas.
   *
   * @param context Contexto 2D.
   */
  private static mountingHoles(context: CanvasRenderingContext2D): void {
    const { width, height, pad, margin, hole } = WorkshopArt.BOARD;
    context.fillStyle = pad;
    [
      { x: margin, y: margin },
      { x: width - margin, y: margin },
      { x: margin, y: height - margin },
      { x: width - margin, y: height - margin },
    ].forEach(({ x, y }) => {
      context.beginPath();
      context.arc(x, y, hole, 0, Math.PI * 2);
      context.fill();
    });
  }

  /**
   * Nombre del proyecto y revisión serigrafiados en blanco en el borde inferior.
   *
   * @param context Contexto 2D.
   * @param label Nombre.
   * @param index Índice de la placa.
   */
  private static silkscreen(context: CanvasRenderingContext2D, label: string, index: number): void {
    const { height, silk, margin, hole, label: size, caption, lineGap } = WorkshopArt.BOARD;
    const left = margin + hole * 2;
    const revision = String.fromCharCode('A'.charCodeAt(0) + index);
    context.fillStyle = silk;
    context.textBaseline = 'alphabetic';
    context.font = `800 ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(label.toUpperCase(), left, height - margin - caption * lineGap);
    context.font = `600 ${String(caption)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(`REV ${revision} · J.REYES`, left, height - margin);
  }

  /**
   * Número pseudoaleatorio determinista a partir de dos enteros.
   *
   * @param a Primer entero.
   * @param b Segundo entero.
   * @returns Valor en [0, 1).
   */
  private static hash(a: number, b: number): number {
    const { a: ka, b: kb, scale } = WorkshopArt.HASH;
    const value = Math.sin(a * ka + b * kb) * scale;
    return value - Math.floor(value);
  }
}
