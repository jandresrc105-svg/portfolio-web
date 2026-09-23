/**
 * Ids de los controles fijos del laboratorio de firmware (las entradas de la lista de programas usan
 * `program-<índice>`, ver `LaptopScreen.programId`).
 */
export enum FirmwareControl {
  /** Botón "Subir" del IDE. */
  Upload = 'upload',
  /** Botón EN de la placa. */
  Reset = 'reset',
  /** Potenciómetro de la protoboard. */
  Pot = 'pot',
  /** Buzzer. */
  Buzzer = 'buzzer',
  /** Servo. */
  Servo = 'servo',
  /** Matriz de LEDs. */
  Matrix = 'matrix',
}
