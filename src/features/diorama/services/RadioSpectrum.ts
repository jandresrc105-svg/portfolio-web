import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { RadioEmission } from '../models/RadioEmission';

/**
 * Espectro de la banda como lo mostraría la FFT de un SDR: para cada casilla de frecuencia suma el piso de
 * ruido (con su titileo) y la energía de cada emisora (una campana en la portadora y, en AM, dos bandas
 * laterales), y lo pasa a decibeles normalizados entre 0 (piso) y 1 (señal más fuerte).
 */
export class RadioSpectrum {
  private static readonly FLOOR = { level: 0.018, jitter: 0.9 };
  private static readonly WIDTH = { carrier: 1.3, sideband: 1.8, offset: 4.5 };
  private static readonly DECIBELS = { floor: -42, range: 42, factor: 20, epsilon: 0.0001 };

  /**
   * Crea el espectro.
   *
   * @param band Borde inferior y superior de la banda en kHz.
   * @param band.from Borde inferior.
   * @param band.to Borde superior.
   * @param random Generador del ruido.
   */
  public constructor(
    private readonly band: { from: number; to: number },
    private readonly random: SeededRandom,
  ) {}

  /**
   * Llena las casillas del espectro.
   *
   * @param out Casillas (de la frecuencia más baja a la más alta), con valores entre 0 y 1.
   * @param emissions Emisoras en el aire.
   */
  public compute(out: Float32Array, emissions: readonly RadioEmission[]): void {
    const { from, to } = this.band;
    const step = (to - from) / Math.max(out.length - 1, 1);
    out.forEach((_value, index) => {
      const frequency = from + index * step;
      const { level, jitter } = RadioSpectrum.FLOOR;
      let power = level * (1 + (this.random.next() - 1 / 2) * jitter);
      emissions.forEach((emission) => {
        power += RadioSpectrum.energy(frequency, emission);
      });
      out[index] = RadioSpectrum.normalize(power);
    });
  }

  /**
   * Energía de una emisora en una frecuencia.
   *
   * @param frequency Frecuencia de la casilla en kHz.
   * @param emission Emisora.
   * @returns Amplitud lineal.
   */
  private static energy(frequency: number, emission: RadioEmission): number {
    const { carrier, sideband, offset } = RadioSpectrum.WIDTH;
    const distance = frequency - emission.frequency;
    const peak = RadioSpectrum.bell(distance, carrier);
    const sides =
      RadioSpectrum.bell(distance - offset, sideband) + RadioSpectrum.bell(distance + offset, sideband);
    return emission.amplitude * (peak + sides * emission.modulation);
  }

  /**
   * Campana de Gauss.
   *
   * @param distance Distancia al centro.
   * @param width Ancho.
   * @returns Valor entre 0 y 1.
   */
  private static bell(distance: number, width: number): number {
    const ratio = distance / Math.max(width, RadioSpectrum.DECIBELS.epsilon);
    return Math.exp(-ratio * ratio);
  }

  /**
   * Pasa una amplitud lineal a decibeles normalizados.
   *
   * @param power Amplitud.
   * @returns Valor entre 0 y 1.
   */
  private static normalize(power: number): number {
    const { floor, range, factor, epsilon } = RadioSpectrum.DECIBELS;
    const decibels = factor * Math.log10(Math.max(power, epsilon));
    return Math.min(Math.max((decibels - floor) / range, 0), 1);
  }
}
