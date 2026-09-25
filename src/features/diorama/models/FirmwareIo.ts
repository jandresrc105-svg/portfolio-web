/**
 * Hardware que ve un programa de la placa (patrón Facade sobre la placa simulada): la matriz de LEDs 8×8 con
 * su controlador MAX7219, el LED de la placa, el servo, el buzzer, el monitor serie y el potenciómetro. Es la
 * misma API que usa el código C++ que se muestra en el editor.
 */
export interface FirmwareIo {
  /** Lectura del potenciómetro con el ADC de 12 bits (`analogRead`, 0–4095). */
  readonly pot: number;

  /**
   * Apaga toda la matriz (`lc.clearDisplay`).
   */
  clear(): void;

  /**
   * Enciende o apaga un LED de la matriz (`lc.setLed`).
   *
   * @param row Fila (0 = arriba).
   * @param column Columna (0 = izquierda).
   * @param on Si queda encendido.
   */
  setLed(row: number, column: number, on: boolean): void;

  /**
   * Escribe una fila completa (`lc.setRow`): el bit 7 es la columna 0.
   *
   * @param row Fila.
   * @param bits Byte de la fila.
   */
  setRow(row: number, bits: number): void;

  /**
   * Escribe una columna completa (`lc.setColumn`): el bit 0 es la fila 0.
   *
   * @param column Columna.
   * @param bits Byte de la columna.
   */
  setColumn(column: number, bits: number): void;

  /**
   * Enciende o apaga el LED de la placa (`digitalWrite(LED_BUILTIN, …)`).
   *
   * @param on Si queda encendido.
   */
  builtin(on: boolean): void;

  /**
   * Mueve el servo (`servo.write`).
   *
   * @param angle Ángulo en grados (0–180).
   */
  servo(angle: number): void;

  /**
   * Hace sonar el buzzer (`tone`).
   *
   * @param hz Frecuencia.
   * @param milliseconds Duración.
   */
  tone(hz: number, milliseconds: number): void;

  /**
   * Escribe una línea en el monitor serie (`Serial.println`).
   *
   * @param line Texto.
   */
  print(line: string): void;

  /**
   * Número entero al azar (`random(max)`).
   *
   * @param max Límite (excluido).
   * @returns Entero en [0, max).
   */
  random(max: number): number;
}
