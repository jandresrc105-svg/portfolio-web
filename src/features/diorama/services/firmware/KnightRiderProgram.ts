import type { FirmwareIo } from '../../models/FirmwareIo';
import type { FirmwareProgram } from '../../models/FirmwareProgram';

/**
 * "Knight Rider": una barra de luz que va y vuelve de un borde al otro de la matriz, como el escáner del
 * auto de la serie.
 */
export class KnightRiderProgram implements FirmwareProgram {
  private static readonly ROWS = { from: 2, to: 6 };
  private static readonly LAST = 7;

  public readonly name = 'Knight Rider';
  public readonly file = 'knight_rider.ino';
  public readonly bytes = 268113;
  public readonly delay = { slow: 180, fast: 25 };
  public readonly source = [
    '#include "lab.h"  // lc (MAX7219), POT, BUZZER',
    '',
    'int pos = 0, dir = 1, pasadas = 0;',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '}',
    '',
    'void loop() {',
    '  lc.clearDisplay(0);',
    '  for (int f = 2; f < 6; f++)',
    '    lc.setLed(0, f, pos, true);',
    '  pos += dir;',
    '  if (pos == 0 || pos == 7) {',
    '    dir = -dir;                  // rebota en el borde',
    '    Serial.printf("pasada %d\\n", ++pasadas);',
    '  }',
    '  delay(map(analogRead(POT), 0, 4095, 180, 25));',
    '}',
  ];

  private position = 0;
  private direction = 1;
  private passes = 0;

  /**
   * @inheritdoc
   */
  public setup(): void {
    this.position = 0;
    this.direction = 1;
    this.passes = 0;
  }

  /**
   * @inheritdoc
   */
  public loop(io: FirmwareIo): void {
    io.clear();
    const { from, to } = KnightRiderProgram.ROWS;
    for (let row = from; row < to; row++) {
      io.setLed(row, this.position, true);
    }
    this.position += this.direction;
    if (this.position === 0 || this.position === KnightRiderProgram.LAST) {
      this.direction = -this.direction;
      this.passes += 1;
      io.print(`pasada ${String(this.passes)}`);
    }
  }
}
