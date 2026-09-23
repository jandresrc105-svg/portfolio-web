import type { GainLimits } from './GainLimits';
import type { LoopMetrics } from './LoopMetrics';
import type { LoopResponse } from './LoopResponse';
import type { PidGains } from './PidGains';
import type { PidSimulator } from './PidSimulator';
import type { SignalSettings } from './SignalSettings';

/**
 * Lazo de control PID que se sintoniza en vivo (única fuente de verdad, patrón Observer): el panel de la
 * sección y las perillas del osciloscopio cambian las ganancias y la referencia (amplitud y frecuencia de
 * la onda cuadrada), y la pantalla, las perillas, el motor y el panel se actualizan al avisar el cambio.
 * Cada cambio resimula un periodo de la respuesta en régimen permanente; la señal en un instante se lee de
 * esa tabla.
 */
export class PidLoopService {
  private static readonly DEFAULT_GAINS: PidGains = { kp: 2.2, ki: 3.6, kd: 0.2 };
  private static readonly DEFAULT_SIGNAL: SignalSettings = { amplitude: 1, frequency: 0.2 };
  private static readonly GAIN_LIMITS: Readonly<Record<keyof PidGains, GainLimits>> = {
    kp: { min: 0, max: 10, step: 0.1 },
    ki: { min: 0, max: 10, step: 0.1 },
    kd: { min: 0, max: 1, step: 0.01 },
  };
  private static readonly SIGNAL_LIMITS: Readonly<Record<keyof SignalSettings, GainLimits>> = {
    amplitude: { min: 0.2, max: 2, step: 0.05 },
    frequency: { min: 0.05, max: 1, step: 0.01 },
  };
  private static readonly DECIMALS = 3;

  private readonly listeners = new Set<() => void>();
  private currentGains: PidGains = PidLoopService.DEFAULT_GAINS;
  private currentSignal: SignalSettings = PidLoopService.DEFAULT_SIGNAL;
  private response: LoopResponse;

  /**
   * Crea el lazo con los valores por defecto.
   *
   * @param simulator Simulador del lazo cerrado.
   */
  public constructor(private readonly simulator: PidSimulator) {
    this.response = simulator.run(this.currentGains, this.currentSignal);
  }

  /**
   * Ganancias actuales.
   *
   * @returns Ganancias.
   */
  public get gains(): PidGains {
    return this.currentGains;
  }

  /**
   * Referencia actual.
   *
   * @returns Amplitud y frecuencia.
   */
  public get signal(): SignalSettings {
    return this.currentSignal;
  }

  /**
   * Indicadores de la respuesta actual.
   *
   * @returns Sobrepico, asentamiento, subida y error final.
   */
  public get metrics(): LoopMetrics {
    return this.response.metrics;
  }

  /**
   * Rango y paso de cada ganancia.
   *
   * @returns Límites por ganancia.
   */
  public get limits(): Readonly<Record<keyof PidGains, GainLimits>> {
    return PidLoopService.GAIN_LIMITS;
  }

  /**
   * Rango y paso de la amplitud y la frecuencia.
   *
   * @returns Límites de la referencia.
   */
  public get signalLimits(): Readonly<Record<keyof SignalSettings, GainLimits>> {
    return PidLoopService.SIGNAL_LIMITS;
  }

  /**
   * Periodo de la referencia (s).
   *
   * @returns Segundos.
   */
  public get period(): number {
    return 1 / this.currentSignal.frequency;
  }

  /**
   * Cambia una o varias ganancias (se ajustan a su rango y paso).
   *
   * @param changes Ganancias nuevas.
   */
  public tune(changes: Partial<PidGains>): void {
    const { kp, ki, kd } = this.currentGains;
    const limits = PidLoopService.GAIN_LIMITS;
    this.apply(
      {
        kp: PidLoopService.fit(limits.kp, changes.kp ?? kp),
        ki: PidLoopService.fit(limits.ki, changes.ki ?? ki),
        kd: PidLoopService.fit(limits.kd, changes.kd ?? kd),
      },
      this.currentSignal,
    );
  }

  /**
   * Cambia la amplitud o la frecuencia de la referencia (se ajustan a su rango y paso).
   *
   * @param changes Valores nuevos.
   */
  public setSignal(changes: Partial<SignalSettings>): void {
    const { amplitude, frequency } = this.currentSignal;
    const limits = PidLoopService.SIGNAL_LIMITS;
    this.apply(this.currentGains, {
      amplitude: PidLoopService.fit(limits.amplitude, changes.amplitude ?? amplitude),
      frequency: PidLoopService.fit(limits.frequency, changes.frequency ?? frequency),
    });
  }

  /**
   * Vuelve a las ganancias y la referencia por defecto.
   */
  public reset(): void {
    this.apply(PidLoopService.DEFAULT_GAINS, PidLoopService.DEFAULT_SIGNAL);
  }

  /**
   * Se suscribe a los cambios de ganancias o referencia.
   *
   * @param listener Se llama tras cada cambio.
   * @returns Función para cancelar la suscripción.
   */
  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Referencia: onda cuadrada que sube al inicio de cada periodo.
   *
   * @param time Instante (s).
   * @returns Valor de la referencia (V).
   */
  public setpoint(time: number): number {
    const { amplitude } = this.currentSignal;
    return this.phase(time) < this.period / 2 ? amplitude : -amplitude;
  }

  /**
   * Salida medida del lazo en régimen permanente.
   *
   * @param time Instante (s).
   * @returns Valor de la salida (V).
   */
  public output(time: number): number {
    const { output, step } = this.response;
    return output[Math.floor(this.phase(time) / step)] ?? 0;
  }

  /**
   * Guarda los valores nuevos, resimula y avisa, si algo cambió.
   *
   * @param gains Ganancias.
   * @param signal Referencia.
   */
  private apply(gains: PidGains, signal: SignalSettings): void {
    const same =
      PidLoopService.equal(gains, this.currentGains) && PidLoopService.equal(signal, this.currentSignal);
    if (same) {
      return;
    }
    this.currentGains = gains;
    this.currentSignal = signal;
    this.response = this.simulator.run(gains, signal);
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  /**
   * Instante dentro del periodo.
   *
   * @param time Instante (s).
   * @returns Segundos desde el último flanco de subida.
   */
  private phase(time: number): number {
    const period = this.period;
    return ((time % period) + period) % period;
  }

  /**
   * Compara dos juegos de valores numéricos con las mismas claves.
   *
   * @param first Primero.
   * @param second Segundo.
   * @returns `true` si todos los valores coinciden.
   */
  private static equal<T extends object>(first: T, second: T): boolean {
    return Object.keys(first).every((key) => first[key as keyof T] === second[key as keyof T]);
  }

  /**
   * Ajusta un valor a su rango y paso.
   *
   * @param limits Rango y paso.
   * @param value Valor pedido.
   * @returns Valor permitido.
   */
  private static fit(limits: GainLimits, value: number): number {
    const { min, max, step } = limits;
    const snapped = Math.round(value / step) * step;
    return Number(Math.min(Math.max(snapped, min), max).toFixed(PidLoopService.DECIMALS));
  }
}
