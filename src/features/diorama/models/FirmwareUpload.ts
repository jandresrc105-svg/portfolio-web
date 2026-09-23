import type { FirmwarePhase } from './FirmwarePhase';

/**
 * Momento de una subida de firmware: etapa, avance y salida del compilador y de esptool.
 */
export interface FirmwareUpload {
  /** Etapa. */
  readonly phase: FirmwarePhase;
  /** Avance total [0, 1]. */
  readonly progress: number;
  /** Texto corto del avance ("Subiendo 38 %"). */
  readonly label: string;
  /** Líneas de la consola hasta este momento. */
  readonly lines: readonly string[];
  /** Si ya terminó. */
  readonly done: boolean;
}
