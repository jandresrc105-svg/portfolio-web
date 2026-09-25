/**
 * Elemento que se puede encender gradualmente (luces, neón, pantallas) durante la secuencia de encendido.
 */
export interface Powerable {
  /**
   * Fija el nivel de energía.
   *
   * @param level 0 = apagado, 1 = encendido completo.
   */
  setPower(level: number): void;
}
