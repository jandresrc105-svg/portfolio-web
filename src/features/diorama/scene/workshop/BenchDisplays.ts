import type { CanvasTexture } from 'three';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Pantallas de los equipos del banco dibujadas en canvas: los displays de siete segmentos de la fuente
 * (voltaje y corriente), la pantalla LCD del multímetro y la temperatura del cautín. Son pequeñas y solo se
 * redibujan cuando cambia el número que muestran.
 */
export class BenchDisplays {
  private static readonly SUPPLY = {
    width: 200,
    height: 72,
    background: '#0a0b0c',
    volts: '#ff4b36',
    amps: '#4dff8a',
    ghost: 'rgba(255, 255, 255, 0.06)',
    size: 28,
    unit: 14,
  };
  private static readonly METER = {
    width: 120,
    height: 56,
    lit: '#a9c4a0',
    dark: '#39433a',
    ink: '#101510',
    size: 30,
    unit: 10,
  };
  private static readonly STATION = {
    width: 100,
    height: 40,
    background: '#0a0b0c',
    color: '#ff5a2e',
    size: 24,
    text: '350°',
  };
  private static readonly PAD = 8;
  private static readonly DECIMALS = { volts: 2, amps: 3 };
  private static readonly LINES = { volts: 0.27, amps: 0.73 };

  /**
   * Crea el pintor.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Displays de la fuente: voltaje en rojo arriba y corriente en verde abajo (apagados si la fuente lo está).
   *
   * @param volts Voltaje.
   * @param amps Corriente.
   * @param on Si la fuente está encendida.
   * @returns Textura.
   */
  public supply(volts: number, amps: number, on: boolean): CanvasTexture {
    const { width, height, background, volts: red, amps: green, ghost } = BenchDisplays.SUPPLY;
    const { DECIMALS, LINES } = BenchDisplays;
    return this.textures.paint(
      width,
      height,
      (context) => {
        context.fillStyle = background;
        context.fillRect(0, 0, width, height);
        context.textBaseline = 'middle';
        context.textAlign = 'right';
        const voltage = { text: volts.toFixed(DECIMALS.volts), unit: 'V', y: height * LINES.volts };
        const current = { text: amps.toFixed(DECIMALS.amps), unit: 'A', y: height * LINES.amps };
        BenchDisplays.readout(context, voltage, on ? red : ghost);
        BenchDisplays.readout(context, current, on ? green : ghost);
      },
      1,
    );
  }

  /**
   * Pantalla LCD del multímetro con el voltaje medido en la placa (apagada si la fuente lo está).
   *
   * @param volts Voltaje medido.
   * @param on Si hay tensión que medir.
   * @returns Textura.
   */
  public meter(volts: number, on: boolean): CanvasTexture {
    const { width, height, lit, dark, ink, size, unit } = BenchDisplays.METER;
    const pad = BenchDisplays.PAD;
    return this.textures.paint(
      width,
      height,
      (context) => {
        context.fillStyle = on ? lit : dark;
        context.fillRect(0, 0, width, height);
        context.fillStyle = ink;
        context.textBaseline = 'middle';
        context.textAlign = 'right';
        context.font = `700 ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
        context.fillText(volts.toFixed(BenchDisplays.DECIMALS.volts), width - pad * 3, height / 2);
        context.font = `700 ${String(unit)}px ${CanvasTextureFactory.MONO_FONT}`;
        context.fillText('VDC', width - pad / 2, height / 2);
      },
      1,
    );
  }

  /**
   * Display de la estación de soldadura con la temperatura de la punta.
   *
   * @returns Textura.
   */
  public station(): CanvasTexture {
    const { width, height, background, color, size, text } = BenchDisplays.STATION;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
      context.fillStyle = color;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `700 ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText(text, width / 2, height / 2);
    });
  }

  /**
   * Una lectura de la fuente, alineada a la derecha con su unidad.
   *
   * @param context Contexto 2D.
   * @param line Lectura.
   * @param line.text Número.
   * @param line.unit Unidad.
   * @param line.y Centro vertical.
   * @param color Color de los segmentos.
   */
  private static readout(
    context: CanvasRenderingContext2D,
    line: { text: string; unit: string; y: number },
    color: string,
  ): void {
    const { width, size, unit } = BenchDisplays.SUPPLY;
    const pad = BenchDisplays.PAD;
    context.fillStyle = color;
    context.font = `700 ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(line.text, width - pad * 3, line.y);
    context.font = `700 ${String(unit)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(line.unit, width - pad, line.y);
  }
}
