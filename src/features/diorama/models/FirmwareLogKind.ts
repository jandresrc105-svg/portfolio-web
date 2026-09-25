/**
 * Origen de una línea de la consola de la laptop (define su color).
 */
export enum FirmwareLogKind {
  /** Compilación y subida. */
  Build = 'build',
  /** Mensajes de arranque del chip. */
  Boot = 'boot',
  /** Salida del programa por el puerto serie. */
  Serial = 'serial',
  /** Lecturas de entradas (potenciómetro, pruebas). */
  Input = 'input',
}
