/**
 * Ganancias de un controlador PID.
 */
export interface PidGains {
  /** Ganancia proporcional. */
  readonly kp: number;
  /** Ganancia integral (1/s). */
  readonly ki: number;
  /** Ganancia derivativa (s). */
  readonly kd: number;
}
