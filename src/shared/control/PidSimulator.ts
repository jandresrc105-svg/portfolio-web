import type { LoopMetrics } from './LoopMetrics';
import type { LoopResponse } from './LoopResponse';
import type { PidGains } from './PidGains';
import type { SignalSettings } from './SignalSettings';

/**
 * Simula un lazo cerrado con controlador PID sobre una planta de tercer orden (tres retardos de primer
 * orden, como un motor con su driver y un sensor filtrado). La referencia es una onda cuadrada de ± la
 * amplitud pedida; con amplitudes grandes el actuador satura antes y la respuesta se vuelve más lenta.
 * El controlador filtra la derivada (sobre la medición, sin "patada" en los escalones), satura el
 * actuador y frena la integral mientras satura (anti-windup). Integra con Euler a paso fijo durante unos
 * periodos para llegar al régimen permanente y devuelve el último.
 */
export class PidSimulator {
  private static readonly PLANT = [{ tau: 0.6 }, { tau: 0.15 }, { tau: 0.1 }];
  private static readonly ACTUATOR_LIMIT = 4;
  private static readonly DERIVATIVE_FILTER = 0.03;
  private static readonly STEP = 0.002;
  private static readonly WARM_UP_PERIODS = 2;
  private static readonly BAND = 0.02;
  private static readonly RISE = { low: 0.1, high: 0.9 };
  private static readonly PERCENT = 100;

  /**
   * Simula el lazo con unas ganancias.
   *
   * @param gains Ganancias del PID.
   * @param signal Amplitud y frecuencia de la referencia.
   * @returns Un periodo de la respuesta, desde el flanco de subida, y sus indicadores.
   */
  public run(gains: PidGains, signal: SignalSettings): LoopResponse {
    const step = PidSimulator.STEP;
    const halfPeriod = 1 / (2 * signal.frequency);
    const { amplitude } = signal;
    const perPeriod = Math.round((2 * halfPeriod) / step);
    const total = perPeriod * (PidSimulator.WARM_UP_PERIODS + 1);
    const state = { lags: PidSimulator.PLANT.map(() => 0), integral: 0, derivative: 0, previous: 0 };
    const output = new Float32Array(perPeriod);
    for (let index = 0; index < total; index += 1) {
      const reference = Math.floor((index * step) / halfPeriod) % 2 === 0 ? amplitude : -amplitude;
      const measured = PidSimulator.advance(state, gains, reference);
      if (index >= total - perPeriod) {
        output[index - (total - perPeriod)] = measured;
      }
    }
    const rising = output.subarray(0, Math.round(halfPeriod / step));
    return { output, step, metrics: PidSimulator.measure(rising, amplitude) };
  }

  /**
   * Avanza un paso: calcula el mando del PID y lo pasa por la planta.
   *
   * @param state Estado del lazo (se modifica).
   * @param state.lags Salida de cada retardo de la planta; el último es la medición.
   * @param state.integral Integral del error.
   * @param state.derivative Derivada filtrada de la medición.
   * @param state.previous Medición del paso anterior.
   * @param gains Ganancias del PID.
   * @param reference Referencia actual.
   * @returns Nueva medición.
   */
  private static advance(
    state: { lags: number[]; integral: number; derivative: number; previous: number },
    gains: PidGains,
    reference: number,
  ): number {
    let input = PidSimulator.control(state, gains, reference);
    PidSimulator.PLANT.forEach(({ tau }, index) => {
      const value = state.lags[index] ?? 0;
      input = value + ((input - value) * PidSimulator.STEP) / tau;
      state.lags[index] = input;
    });
    return input;
  }

  /**
   * Mando del PID con derivada filtrada sobre la medición, saturación y anti-windup.
   *
   * @param state Estado del lazo (actualiza integral, derivada y medición anterior).
   * @param state.lags Salida de cada retardo de la planta.
   * @param state.integral Integral del error.
   * @param state.derivative Derivada filtrada de la medición.
   * @param state.previous Medición del paso anterior.
   * @param gains Ganancias del PID.
   * @param reference Referencia actual.
   * @returns Mando saturado del actuador.
   */
  private static control(
    state: { lags: number[]; integral: number; derivative: number; previous: number },
    gains: PidGains,
    reference: number,
  ): number {
    const step = PidSimulator.STEP;
    const measured = state.lags[state.lags.length - 1] ?? 0;
    const error = reference - measured;
    const slope = -(measured - state.previous) / step;
    state.derivative += ((slope - state.derivative) * step) / (PidSimulator.DERIVATIVE_FILTER + step);
    state.previous = measured;
    const demand = gains.kp * error + gains.ki * state.integral + gains.kd * state.derivative;
    const limit = PidSimulator.ACTUATOR_LIMIT;
    const command = Math.min(Math.max(demand, -limit), limit);
    if (command === demand || Math.sign(error) !== Math.sign(demand)) {
      state.integral += error * step;
    }
    return command;
  }

  /**
   * Indicadores del escalón de subida (primera mitad del periodo, de -amplitud a +amplitud), en
   * proporción al tamaño del escalón.
   *
   * @param rising Escalón de subida.
   * @param amplitude Amplitud de la referencia.
   * @returns Indicadores.
   */
  private static measure(rising: Float32Array, amplitude: number): LoopMetrics {
    const size = amplitude * 2;
    const peak = rising.reduce((highest, value) => Math.max(highest, value), -Infinity);
    const last = rising[rising.length - 1] ?? 0;
    return {
      overshoot: Math.max(((peak - amplitude) / size) * PidSimulator.PERCENT, 0),
      settlingTime: PidSimulator.settling(rising, amplitude),
      riseTime: PidSimulator.rise(rising, amplitude),
      steadyError: (Math.abs(amplitude - last) / size) * PidSimulator.PERCENT,
    };
  }

  /**
   * Tiempo hasta quedar para siempre dentro de la banda del 2 % alrededor de la referencia.
   *
   * @param rising Escalón de subida.
   * @param amplitude Amplitud de la referencia.
   * @returns Segundos, o `null` si al final del semiperiodo sigue fuera de la banda.
   */
  private static settling(rising: Float32Array, amplitude: number): number | null {
    const band = PidSimulator.BAND * amplitude * 2;
    let outside = -1;
    rising.forEach((value, index) => {
      if (Math.abs(value - amplitude) > band) {
        outside = index;
      }
    });
    return outside >= rising.length - 1 ? null : (outside + 1) * PidSimulator.STEP;
  }

  /**
   * Tiempo de subida del 10 % al 90 % del escalón.
   *
   * @param rising Escalón de subida.
   * @param amplitude Amplitud de la referencia.
   * @returns Segundos, o `null` si no llega al 90 %.
   */
  private static rise(rising: Float32Array, amplitude: number): number | null {
    const { low, high } = PidSimulator.RISE;
    const progress = (value: number): number => (value + amplitude) / (amplitude * 2);
    const start = rising.findIndex((value) => progress(value) >= low);
    const end = rising.findIndex((value) => progress(value) >= high);
    return start < 0 || end < 0 ? null : (end - start) * PidSimulator.STEP;
  }
}
