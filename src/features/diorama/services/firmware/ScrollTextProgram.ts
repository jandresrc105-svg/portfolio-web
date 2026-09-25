import type { FirmwareIo } from '../../models/FirmwareIo';
import type { FirmwareProgram } from '../../models/FirmwareProgram';

/**
 * "Texto HOLA": arma una cinta de columnas con una fuente de 5×7 y la desplaza por la matriz, una columna por
 * vuelta.
 */
export class ScrollTextProgram implements FirmwareProgram {
  private static readonly FONT = [
    [{ bits: 0x7f }, { bits: 0x08 }, { bits: 0x08 }, { bits: 0x08 }, { bits: 0x7f }],
    [{ bits: 0x3e }, { bits: 0x41 }, { bits: 0x41 }, { bits: 0x41 }, { bits: 0x3e }],
    [{ bits: 0x7f }, { bits: 0x40 }, { bits: 0x40 }, { bits: 0x40 }, { bits: 0x40 }],
    [{ bits: 0x7e }, { bits: 0x09 }, { bits: 0x09 }, { bits: 0x09 }, { bits: 0x7e }],
  ];
  private static readonly GAP = 1;
  private static readonly TAIL = 4;
  private static readonly COLUMNS = 8;
  private static readonly WORD = 'HOLA';

  public readonly name = 'Texto HOLA';
  public readonly file = 'hola.ino';
  public readonly bytes = 270238;
  public readonly delay = { slow: 220, fast: 30 };
  public readonly source = [
    '#include "lab.h"  // lc (MAX7219), POT, BUZZER',
    '',
    'const byte FUENTE[4][5] = {       // 5×7, por columnas',
    '  {0x7F, 0x08, 0x08, 0x08, 0x7F},  // H',
    '  {0x3E, 0x41, 0x41, 0x41, 0x3E},  // O',
    '  {0x7F, 0x40, 0x40, 0x40, 0x40},  // L',
    '  {0x7E, 0x09, 0x09, 0x09, 0x7E},  // A',
    '};',
    'byte cinta[32];',
    'int largo = 0, x = 0;',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  for (int l = 0; l < 4; l++) {',
    '    memcpy(cinta + largo, FUENTE[l], 5);',
    '    largo += 6;                    // letra + espacio',
    '  }',
    '  largo += 4;',
    '}',
    '',
    'void loop() {',
    '  for (int c = 0; c < 8; c++)',
    '    lc.setColumn(0, c, cinta[(x + c) % largo]);',
    '  x = (x + 1) % largo;',
    '  if (x == 0) Serial.println("HOLA");',
    '  delay(map(analogRead(POT), 0, 4095, 220, 30));',
    '}',
  ];

  private readonly tape: number[] = ScrollTextProgram.buildTape();
  private offset = 0;

  /**
   * @inheritdoc
   */
  public setup(): void {
    this.offset = 0;
  }

  /**
   * @inheritdoc
   */
  public loop(io: FirmwareIo): void {
    const length = this.tape.length;
    for (let column = 0; column < ScrollTextProgram.COLUMNS; column++) {
      io.setColumn(column, this.tape[(this.offset + column) % length] ?? 0);
    }
    this.offset = (this.offset + 1) % length;
    if (this.offset === 0) {
      io.print(ScrollTextProgram.WORD);
    }
  }

  /**
   * Cinta de columnas: cada letra, una columna vacía entre letras y un hueco al final.
   *
   * @returns Bytes de las columnas.
   */
  private static buildTape(): number[] {
    const tape: number[] = [];
    ScrollTextProgram.FONT.forEach((letter) => {
      tape.push(...letter.map(({ bits }) => bits), ...new Array<number>(ScrollTextProgram.GAP).fill(0));
    });
    tape.push(...new Array<number>(ScrollTextProgram.TAIL).fill(0));
    return tape;
  }
}
