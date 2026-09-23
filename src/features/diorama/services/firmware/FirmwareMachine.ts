import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { FirmwareIo } from '../../models/FirmwareIo';

/**
 * Placa simulada donde corren los programas: guarda la matriz 8×8, el LED de la placa, el servo, la
 * lectura del potenciómetro y lo que el programa escribe en el puerto serie o hace sonar en el buzzer (el
 * service lo recoge después de cada vuelta).
 */
export class FirmwareMachine implements FirmwareIo {
  public static readonly SIZE = 8;
  public static readonly ADC_MAX = 4095;

  private static readonly HIGH_BIT = 0x80;
  private static readonly SERVO = { min: 0, max: 180, rest: 90 };

  public readonly matrix = new Uint8Array(FirmwareMachine.SIZE * FirmwareMachine.SIZE);
  public pot = Math.round(FirmwareMachine.ADC_MAX / 2);
  public led = false;
  public angle = FirmwareMachine.SERVO.rest;
  public traffic = 0;

  private readonly lines: string[] = [];
  private readonly tones: { hz: number; milliseconds: number }[] = [];

  /**
   * Crea la placa.
   *
   * @param generator Generador determinista para `random`.
   */
  public constructor(private readonly generator: SeededRandom) {}

  /**
   * Apaga todo lo de la placa como en un reinicio (el servo se queda donde estaba).
   */
  public reset(): void {
    this.clear();
    this.led = false;
    this.lines.length = 0;
    this.tones.length = 0;
  }

  /**
   * @inheritdoc
   */
  public clear(): void {
    this.matrix.fill(0);
  }

  /**
   * @inheritdoc
   */
  public setLed(row: number, column: number, on: boolean): void {
    if (FirmwareMachine.inside(row) && FirmwareMachine.inside(column)) {
      this.matrix[row * FirmwareMachine.SIZE + column] = on ? 1 : 0;
    }
  }

  /**
   * @inheritdoc
   */
  public setRow(row: number, bits: number): void {
    for (let column = 0; column < FirmwareMachine.SIZE; column++) {
      this.setLed(row, column, (bits & (FirmwareMachine.HIGH_BIT >> column)) !== 0);
    }
  }

  /**
   * @inheritdoc
   */
  public setColumn(column: number, bits: number): void {
    for (let row = 0; row < FirmwareMachine.SIZE; row++) {
      this.setLed(row, column, (bits & (1 << row)) !== 0);
    }
  }

  /**
   * @inheritdoc
   */
  public builtin(on: boolean): void {
    this.led = on;
  }

  /**
   * @inheritdoc
   */
  public servo(angle: number): void {
    const { min, max } = FirmwareMachine.SERVO;
    this.angle = Math.min(Math.max(angle, min), max);
  }

  /**
   * @inheritdoc
   */
  public tone(hz: number, milliseconds: number): void {
    this.tones.push({ hz, milliseconds });
  }

  /**
   * @inheritdoc
   */
  public print(line: string): void {
    this.lines.push(line);
    this.traffic += 1;
  }

  /**
   * @inheritdoc
   */
  public random(max: number): number {
    return Math.floor(this.generator.next() * max);
  }

  /**
   * Entrega y olvida las líneas escritas por el puerto serie.
   *
   * @returns Líneas.
   */
  public takeLines(): string[] {
    return this.lines.splice(0);
  }

  /**
   * Entrega y olvida los pitidos pedidos.
   *
   * @returns Pitidos.
   */
  public takeTones(): { hz: number; milliseconds: number }[] {
    return this.tones.splice(0);
  }

  /**
   * Indica si un índice de fila o columna cae dentro de la matriz.
   *
   * @param index Índice.
   * @returns `true` si está dentro.
   */
  private static inside(index: number): boolean {
    return index >= 0 && index < FirmwareMachine.SIZE;
  }
}
