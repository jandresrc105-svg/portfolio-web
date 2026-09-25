import type { FirmwareLogKind } from './FirmwareLogKind';

/**
 * Línea de la consola de la laptop.
 */
export interface FirmwareLogLine {
  /** Texto. */
  readonly text: string;
  /** Origen de la línea. */
  readonly kind: FirmwareLogKind;
}
