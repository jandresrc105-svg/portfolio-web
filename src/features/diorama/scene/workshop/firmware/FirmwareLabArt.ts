import type { CanvasTexture } from 'three';
import { CanvasTextureFactory } from '../../CanvasTextureFactory';

/**
 * Texturas fijas del laboratorio de firmware, dibujadas una vez en canvas: la serigrafía de la placa ESP32,
 * los agujeros y rieles de la protoboard, el teclado de la laptop y el letrero de la pared.
 */
export class FirmwareLabArt {
  private static readonly BOARD = { width: 256, height: 128, pins: 15, pad: 3.2, margin: 10 };
  private static readonly BOARD_LABELS = [
    { text: 'JR-32 DevKit', x: 150, y: 64, size: 13 },
    { text: 'EN', x: 26, y: 36, size: 9 },
    { text: 'BOOT', x: 30, y: 94, size: 9 },
    { text: 'PWR  TX  RX  IO2', x: 70, y: 22, size: 7 },
    { text: 'USB', x: 14, y: 64, size: 8 },
  ];
  private static readonly BREADBOARD = { width: 256, height: 96, columns: 30, rows: 5, hole: 2.4, rail: 7 };
  private static readonly KEYBOARD = { width: 256, height: 96, rows: 5, columns: 14, gap: 3, margin: 6 };
  private static readonly SIGN = { width: 256, height: 64, title: 3, subtitle: 6, line: 0.75 };
  private static readonly COLORS = {
    board: '#10161d',
    silk: '#e8edf2',
    pad: '#c9a646',
    trace: '#1b2733',
    breadboard: '#ebe7dc',
    hole: '#3b3a36',
    red: '#d8433b',
    blue: '#2f64c9',
    keyboard: '#1c1f24',
    key: '#2c3036',
    sign: '#3fd8ff',
    signDim: '#9fe9ff',
  };
  private static readonly WEIGHT = 700;

  /**
   * Crea las texturas.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Serigrafía de la placa: fondo negro mate, pads dorados de los pines, pistas y rótulos.
   *
   * @returns Textura.
   */
  public board(): CanvasTexture {
    const { width, height } = FirmwareLabArt.BOARD;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = FirmwareLabArt.COLORS.board;
      context.fillRect(0, 0, width, height);
      FirmwareLabArt.traces(context);
      FirmwareLabArt.pads(context);
      FirmwareLabArt.BOARD_LABELS.forEach(({ text, x, y, size }) => {
        FirmwareLabArt.label(context, text, { x, y, size });
      });
    });
  }

  /**
   * Protoboard: dos bloques de agujeros y los rieles rojo y azul de alimentación.
   *
   * @returns Textura.
   */
  public breadboard(): CanvasTexture {
    const { width, height, columns, rows, hole, rail } = FirmwareLabArt.BREADBOARD;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = FirmwareLabArt.COLORS.breadboard;
      context.fillRect(0, 0, width, height);
      const step = width / columns;
      [
        { y: rail * 2, color: FirmwareLabArt.COLORS.red },
        { y: height - rail * 2, color: FirmwareLabArt.COLORS.blue },
      ].forEach(({ y, color }) => {
        context.fillStyle = color;
        context.fillRect(0, y, width, 1);
      });
      context.fillStyle = FirmwareLabArt.COLORS.hole;
      for (let column = 0; column < columns; column++) {
        FirmwareLabArt.holeColumn(context, { x: step * (column + 0.5), step, rows, hole });
      }
    });
  }

  /**
   * Teclado de la laptop: teclas oscuras en una cuadrícula.
   *
   * @returns Textura.
   */
  public keyboard(): CanvasTexture {
    const { width, height, rows, columns, gap, margin } = FirmwareLabArt.KEYBOARD;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = FirmwareLabArt.COLORS.keyboard;
      context.fillRect(0, 0, width, height);
      context.fillStyle = FirmwareLabArt.COLORS.key;
      const keyWidth = (width - margin * 2) / columns;
      const keyHeight = (height - margin * 2) / rows;
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const x = margin + column * keyWidth;
          context.fillRect(x, margin + row * keyHeight, keyWidth - gap, keyHeight - gap);
        }
      }
    });
  }

  /**
   * Letrero de neón de la pared: "</> FIRMWARE LAB" y una línea con las tecnologías.
   *
   * @returns Textura con transparencia.
   */
  public sign(): CanvasTexture {
    const { width, height, title, subtitle, line } = FirmwareLabArt.SIGN;
    return this.textures.paint(width, height, (context) => {
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = FirmwareLabArt.COLORS.sign;
      context.font = FirmwareLabArt.font(height / title);
      context.fillText('</> FIRMWARE LAB', width / 2, height / title);
      context.fillStyle = FirmwareLabArt.COLORS.signDim;
      context.font = FirmwareLabArt.font(height / subtitle);
      context.fillText('ESP32 · C++ · FreeRTOS · MicroPython', width / 2, height * line);
    });
  }

  /**
   * Pistas de cobre bajo la máscara.
   *
   * @param context Contexto 2D.
   */
  private static traces(context: CanvasRenderingContext2D): void {
    const { width, height, margin } = FirmwareLabArt.BOARD;
    context.strokeStyle = FirmwareLabArt.COLORS.trace;
    context.lineWidth = 2;
    for (let line = 1; line <= margin / 2; line++) {
      context.beginPath();
      context.moveTo(margin * 2, height / 2 + line * margin - margin * 3);
      context.lineTo(width / 2, height / 2 + line * margin - margin * 3);
      context.lineTo(width / 2 + margin * 2, height / 2);
      context.stroke();
    }
  }

  /**
   * Pads dorados de las dos filas de pines.
   *
   * @param context Contexto 2D.
   */
  private static pads(context: CanvasRenderingContext2D): void {
    const { width, height, pins, pad, margin } = FirmwareLabArt.BOARD;
    context.fillStyle = FirmwareLabArt.COLORS.pad;
    const step = (width - margin * 2) / pins;
    for (let pin = 0; pin < pins; pin++) {
      const x = margin + step * (pin + 0.5);
      [margin / 2, height - margin / 2].forEach((y) => {
        context.beginPath();
        context.arc(x, y, pad, 0, Math.PI * 2);
        context.fill();
      });
    }
  }

  /**
   * Columna de agujeros de la protoboard (dos bloques de cinco y los rieles).
   *
   * @param context Contexto 2D.
   * @param column Posición y medidas.
   * @param column.x Centro horizontal.
   * @param column.step Separación entre agujeros.
   * @param column.rows Agujeros por bloque.
   * @param column.hole Lado de un agujero.
   */
  private static holeColumn(
    context: CanvasRenderingContext2D,
    column: { x: number; step: number; rows: number; hole: number },
  ): void {
    const { height, rail } = FirmwareLabArt.BREADBOARD;
    const { x, step, rows, hole } = column;
    const ys = [rail, height - rail];
    for (let row = 0; row < rows; row++) {
      ys.push(height / 2 - step * (row + 1), height / 2 + step * (row + 1));
    }
    ys.forEach((y) => {
      context.fillRect(x - hole / 2, y - hole / 2, hole, hole);
    });
  }

  /**
   * Rótulo blanco de la serigrafía.
   *
   * @param context Contexto 2D.
   * @param text Texto.
   * @param at Posición y tamaño.
   * @param at.x Centro horizontal.
   * @param at.y Centro vertical.
   * @param at.size Tamaño de letra.
   */
  private static label(
    context: CanvasRenderingContext2D,
    text: string,
    at: { x: number; y: number; size: number },
  ): void {
    context.fillStyle = FirmwareLabArt.COLORS.silk;
    context.font = FirmwareLabArt.font(at.size);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, at.x, at.y);
  }

  /**
   * Fuente de los rótulos.
   *
   * @param size Tamaño.
   * @returns Fuente CSS.
   */
  private static font(size: number): string {
    return `${String(FirmwareLabArt.WEIGHT)} ${String(size)}px ${CanvasTextureFactory.SANS_FONT}`;
  }
}
