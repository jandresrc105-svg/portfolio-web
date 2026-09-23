import type { BoardArt } from '../../models/BoardArt';
import type { BoardPart } from '../../models/BoardPart';

/**
 * Diseño de la placa del controlador (PID-SERVO v1.2): microcontrolador con su cristal y conector SWD,
 * driver de puente H hacia la bornera del motor, regulador con sus condensadores, USB-C, LEDs de estado y
 * puntos de prueba donde se engancha la sonda. Las piezas 3D y el arte (pistas, pads y serigrafía) salen
 * de las mismas medidas.
 */
export class CircuitBoardLayout {
  private static readonly BOARD = { width: 0.16, depth: 0.1, thickness: 0.0016, standoff: 0.006 };
  private static readonly HOLES = [
    { x: -0.074, z: -0.044 },
    { x: 0.074, z: -0.044 },
    { x: -0.074, z: 0.044 },
    { x: 0.074, z: 0.044 },
  ];
  private static readonly HOLE_RADIUS = 0.0022;
  private static readonly PARTS: readonly BoardPart[] = [
    { kind: 'qfp', x: -0.018, z: -0.004, width: 0.014, depth: 0.014, label: 'U1' },
    { kind: 'crystal', x: -0.018, z: -0.025, width: 0.011, depth: 0.0045, label: 'Y1' },
    { kind: 'soic', x: 0.03, z: -0.004, width: 0.0095, depth: 0.0052, label: 'U2' },
    { kind: 'sot', x: 0.05, z: -0.033, width: 0.0065, depth: 0.0035, label: 'U3' },
    { kind: 'capacitor', x: 0.066, z: -0.032, width: 0.008, depth: 0.008, label: 'C1' },
    { kind: 'capacitor', x: 0.066, z: -0.015, width: 0.008, depth: 0.008, label: 'C2' },
    { kind: 'header', x: -0.018, z: -0.041, width: 0.0203, depth: 0.0051, label: 'J1 SWD' },
    { kind: 'usb', x: -0.076, z: 0, width: 0.008, depth: 0.009, label: 'USB' },
    { kind: 'terminal', x: 0.071, z: 0.024, width: 0.009, depth: 0.011, label: 'M1' },
    { kind: 'testpoint', x: 0.004, z: 0.036, width: 0.003, depth: 0.003, label: 'TP1 OUT' },
    { kind: 'testpoint', x: 0.018, z: 0.036, width: 0.003, depth: 0.003, label: 'TP2 GND' },
  ];
  private static readonly LEDS = [
    { x: -0.058, z: 0.034, label: 'PWR' },
    { x: -0.048, z: 0.034, label: 'RUN' },
    { x: -0.038, z: 0.034, label: 'ERR' },
  ];
  private static readonly LED = { width: 0.0024, depth: 0.0013 };
  private static readonly PASSIVES = [
    { x: -0.004, z: -0.016, turn: 0 },
    { x: -0.004, z: -0.012, turn: 0 },
    { x: -0.004, z: 0.008, turn: 0 },
    { x: -0.032, z: 0.008, turn: 1 },
    { x: -0.034, z: -0.014, turn: 1 },
    { x: -0.012, z: -0.025, turn: 1 },
    { x: -0.024, z: -0.025, turn: 1 },
    { x: 0.018, z: -0.012, turn: 0 },
    { x: 0.042, z: -0.012, turn: 0 },
    { x: 0.042, z: 0.004, turn: 0 },
    { x: 0.056, z: -0.022, turn: 1 },
    { x: -0.058, z: 0.026, turn: 0 },
    { x: -0.048, z: 0.026, turn: 0 },
    { x: -0.038, z: 0.026, turn: 0 },
    { x: -0.064, z: -0.008, turn: 1 },
    { x: -0.064, z: 0.008, turn: 1 },
  ];
  private static readonly PASSIVE = { width: 0.0026, depth: 0.0013 };
  private static readonly TRACES = [
    {
      width: 0.0007,
      points: [
        { x: -0.01, z: -0.008 },
        { x: 0.012, z: -0.008 },
        { x: 0.016, z: -0.006 },
        { x: 0.025, z: -0.006 },
      ],
    },
    {
      width: 0.0007,
      points: [
        { x: -0.01, z: -0.004 },
        { x: 0.025, z: -0.004 },
      ],
    },
    {
      width: 0.0007,
      points: [
        { x: -0.01, z: 0 },
        { x: 0.012, z: 0 },
        { x: 0.016, z: -0.002 },
        { x: 0.025, z: -0.002 },
      ],
    },
    {
      width: 0.0014,
      points: [
        { x: 0.035, z: -0.006 },
        { x: 0.058, z: -0.006 },
        { x: 0.064, z: 0.012 },
        { x: 0.068, z: 0.02 },
      ],
    },
    {
      width: 0.0014,
      points: [
        { x: 0.035, z: -0.002 },
        { x: 0.052, z: -0.002 },
        { x: 0.06, z: 0.02 },
        { x: 0.068, z: 0.028 },
      ],
    },
    {
      width: 0.0016,
      points: [
        { x: -0.072, z: 0 },
        { x: -0.066, z: 0 },
        { x: -0.06, z: -0.03 },
        { x: 0.046, z: -0.03 },
      ],
    },
    {
      width: 0.0016,
      points: [
        { x: 0.054, z: -0.033 },
        { x: 0.062, z: -0.033 },
      ],
    },
    {
      width: 0.0016,
      points: [
        { x: 0.054, z: -0.033 },
        { x: 0.058, z: -0.015 },
        { x: 0.062, z: -0.015 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.022, z: -0.011 },
        { x: -0.022, z: -0.022 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.014, z: -0.011 },
        { x: -0.014, z: -0.022 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.026, z: -0.011 },
        { x: -0.026, z: -0.036 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.01, z: -0.011 },
        { x: -0.01, z: -0.036 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.025, z: 0.003 },
        { x: -0.038, z: 0.016 },
        { x: -0.038, z: 0.026 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.025, z: 0 },
        { x: -0.048, z: 0.016 },
        { x: -0.048, z: 0.026 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.025, z: -0.003 },
        { x: -0.058, z: 0.012 },
        { x: -0.058, z: 0.026 },
      ],
    },
    {
      width: 0.0008,
      points: [
        { x: -0.018, z: 0.003 },
        { x: -0.018, z: 0.02 },
        { x: 0, z: 0.03 },
        { x: 0.004, z: 0.036 },
      ],
    },
    {
      width: 0.0012,
      points: [
        { x: 0.018, z: 0.036 },
        { x: 0.03, z: 0.036 },
        { x: 0.045, z: 0.02 },
        { x: 0.045, z: 0.008 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.072, z: -0.003 },
        { x: -0.064, z: -0.008 },
        { x: -0.025, z: -0.008 },
      ],
    },
    {
      width: 0.0006,
      points: [
        { x: -0.072, z: 0.003 },
        { x: -0.064, z: 0.008 },
        { x: -0.025, z: 0.006 },
      ],
    },
  ];
  private static readonly TITLE = [
    { text: 'PID-SERVO v1.2', x: 0.022, z: 0.043, size: 0.0042 },
    { text: 'JR · 2026', x: 0.06, z: 0.043, size: 0.0032 },
  ];
  private static readonly LABEL = { size: 0.0026, gap: 0.0035 };
  private static readonly OUTLINE_MARGIN = 0.0015;
  private static readonly PAD = { size: 0.0012 };

  /**
   * Medidas de la placa.
   *
   * @returns Ancho, profundidad, grosor y alto de los separadores.
   */
  public get board(): { width: number; depth: number; thickness: number; standoff: number } {
    return CircuitBoardLayout.BOARD;
  }

  /**
   * Agujeros de montaje (donde van los separadores).
   *
   * @returns Centros de los agujeros.
   */
  public get holes(): readonly { x: number; z: number }[] {
    return CircuitBoardLayout.HOLES;
  }

  /**
   * Componentes principales.
   *
   * @returns Componentes.
   */
  public parts(): readonly BoardPart[] {
    return CircuitBoardLayout.PARTS;
  }

  /**
   * LEDs de estado: encendido, lazo en marcha y error.
   *
   * @returns LEDs, en ese orden.
   */
  public leds(): BoardPart[] {
    const { width, depth } = CircuitBoardLayout.LED;
    return CircuitBoardLayout.LEDS.map(({ x, z, label }) => ({ kind: 'led', x, z, width, depth, label }));
  }

  /**
   * Resistencias y condensadores de montaje superficial.
   *
   * @returns Componentes pasivos.
   */
  public passives(): BoardPart[] {
    const { width, depth } = CircuitBoardLayout.PASSIVE;
    return CircuitBoardLayout.PASSIVES.map(({ x, z, turn }) => ({
      kind: 'passive',
      x,
      z,
      width: turn === 0 ? width : depth,
      depth: turn === 0 ? depth : width,
    }));
  }

  /**
   * Arte de la placa: pistas, pads, contornos, textos y agujeros.
   *
   * @returns Arte.
   */
  public art(): BoardArt {
    const labeled = [...CircuitBoardLayout.PARTS, ...this.leds()];
    return {
      traces: CircuitBoardLayout.TRACES,
      pads: this.passives().flatMap((part) => CircuitBoardLayout.endPads(part)),
      outlines: labeled.map(({ x, z, width, depth }) => CircuitBoardLayout.outline(x, z, width, depth)),
      labels: [
        ...labeled.flatMap((part) => CircuitBoardLayout.designator(part)),
        ...CircuitBoardLayout.TITLE,
      ],
      holes: CircuitBoardLayout.HOLES.map(({ x, z }) => ({ x, z, radius: CircuitBoardLayout.HOLE_RADIUS })),
    };
  }

  /**
   * Contorno de serigrafía con un margen alrededor del componente.
   *
   * @param x Centro horizontal.
   * @param z Centro en profundidad.
   * @param width Ancho.
   * @param depth Profundidad.
   * @returns Contorno.
   */
  private static outline(x: number, z: number, width: number, depth: number): BoardArt['outlines'][number] {
    const margin = CircuitBoardLayout.OUTLINE_MARGIN * 2;
    return { x, z, width: width + margin, depth: depth + margin };
  }

  /**
   * Designador impreso detrás del componente.
   *
   * @param part Componente.
   * @returns Texto, o nada si no tiene designador.
   */
  private static designator(part: BoardPart): BoardArt['labels'][number][] {
    const { size, gap } = CircuitBoardLayout.LABEL;
    return part.label ? [{ text: part.label, x: part.x, z: part.z - part.depth / 2 - gap, size }] : [];
  }

  /**
   * Pads en los extremos de un componente pasivo.
   *
   * @param part Componente pasivo.
   * @returns Dos pads.
   */
  private static endPads(part: BoardPart): BoardArt['pads'][number][] {
    const size = CircuitBoardLayout.PAD.size;
    const alongX = part.width > part.depth;
    const offset = (alongX ? part.width : part.depth) / 2;
    return [-1, 1].map((side) => ({
      x: part.x + (alongX ? side * offset : 0),
      z: part.z + (alongX ? 0 : side * offset),
      width: size,
      depth: size,
    }));
  }
}
