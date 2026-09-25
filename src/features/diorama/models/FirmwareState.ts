import type { FirmwareLogLine } from './FirmwareLogLine';
import type { FirmwarePhase } from './FirmwarePhase';
import type { FirmwareProgram } from './FirmwareProgram';

/**
 * Estado del laboratorio de firmware: el IDE de la laptop y la placa con lo que tiene conectado.
 */
export interface FirmwareState {
  /** Programas disponibles. */
  readonly programs: readonly FirmwareProgram[];
  /** Programa abierto en el editor. */
  readonly selected: number;
  /** Programa que corre en la placa. */
  readonly running: number;
  /** Etapa. */
  readonly phase: FirmwarePhase;
  /** Avance de la subida [0, 1]. */
  readonly progress: number;
  /** Texto de la barra de estado. */
  readonly label: string;
  /** Líneas de la consola (las últimas). */
  readonly log: readonly FirmwareLogLine[];
  /** LEDs de la matriz (fila × 8 + columna), 1 = encendido. */
  readonly matrix: Uint8Array;
  /** LED de la placa. */
  readonly builtin: boolean;
  /** Ángulo pedido al servo (grados). */
  readonly servo: number;
  /** Frecuencia que suena en el buzzer (0 = callado). */
  readonly buzzer: number;
  /** Lectura del potenciómetro (0–4095). */
  readonly pot: number;
  /** Pausa actual de `loop` (ms). */
  readonly delay: number;
  /** Contador de tráfico por el puerto serie (hace parpadear TX). */
  readonly traffic: number;
  /** Cambia cada vez que cambia algo que muestra la pantalla. */
  readonly revision: number;
}
