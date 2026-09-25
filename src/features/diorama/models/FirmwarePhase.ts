/**
 * Etapa de la placa del laboratorio de firmware.
 */
export enum FirmwarePhase {
  /** Corre el programa subido. */
  Running = 'running',
  /** El IDE compila el boceto. */
  Compiling = 'compiling',
  /** esptool se conecta y escribe la flash. */
  Flashing = 'flashing',
}
