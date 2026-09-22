import type { SignalSample } from '../models/SignalSample';

/**
 * Simula un lazo de control: la referencia es una onda cuadrada y la salida es la respuesta al escalón
 * de un sistema de segundo orden subamortiguado (sobrepico y asentamiento), como en un control PID bien sintonizado.
 */
export class SignalService {
  private static readonly HALF_PERIOD = 3.2;
  private static readonly AMPLITUDE = 0.62;
  private static readonly DAMPING = 0.3;
  private static readonly NATURAL_FREQUENCY = 4.4;
  private static readonly WINDOW_SECONDS = 6.4;

  /**
   * Calcula la traza visible del osciloscopio que termina en el instante actual.
   *
   * @param time Tiempo actual en segundos.
   * @param samples Número de puntos de la traza.
   * @returns Muestras de referencia y salida, de la más antigua a la más reciente.
   */
  public trace(time: number, samples: number): SignalSample[] {
    const start = time - SignalService.WINDOW_SECONDS;
    return Array.from({ length: samples }, (_, index) => {
      const instant = start + (index / (samples - 1)) * SignalService.WINDOW_SECONDS;
      return { setpoint: this.setpoint(instant), output: this.output(instant) };
    });
  }

  /**
   * Referencia: onda cuadrada simétrica.
   *
   * @param time Instante en segundos.
   * @returns Valor de la referencia.
   */
  public setpoint(time: number): number {
    const half = Math.floor(time / SignalService.HALF_PERIOD);
    return (Math.abs(half) % 2 === 0 ? 1 : -1) * SignalService.AMPLITUDE;
  }

  /**
   * Salida del sistema: parte del valor anterior y sigue la respuesta al escalón hacia la nueva referencia.
   *
   * @param time Instante en segundos.
   * @returns Valor de la salida.
   */
  public output(time: number): number {
    const elapsed = time - Math.floor(time / SignalService.HALF_PERIOD) * SignalService.HALF_PERIOD;
    const previous = this.setpoint(time - SignalService.HALF_PERIOD);
    const target = this.setpoint(time);
    return previous + (target - previous) * SignalService.stepResponse(elapsed);
  }

  /**
   * Respuesta normalizada al escalón de un sistema de segundo orden subamortiguado.
   *
   * @param time Segundos desde el escalón.
   * @returns Salida normalizada (1 = referencia alcanzada).
   */
  private static stepResponse(time: number): number {
    const zeta = SignalService.DAMPING;
    const omega = SignalService.NATURAL_FREQUENCY;
    const damped = omega * Math.sqrt(1 - zeta ** 2);
    const decay = Math.exp(-zeta * omega * time);
    return (
      1 - decay * (Math.cos(damped * time) + (zeta / Math.sqrt(1 - zeta ** 2)) * Math.sin(damped * time))
    );
  }
}
