import type { FirmwareIo } from '../../models/FirmwareIo';
import type { FirmwareProgram } from '../../models/FirmwareProgram';

/**
 * "Conway": el Juego de la vida en un tablero toroidal de 8×8 (los bordes se tocan). Cada vuelta calcula una
 * generación: una célula nace con 3 vecinas y sobrevive con 2 o 3. Si el tablero muere, se congela o llega a
 * 96 generaciones (atrapado en un ciclo), vuelve a sembrar al azar.
 */
export class LifeProgram implements FirmwareProgram {
  private static readonly SIZE = 8;
  private static readonly RESEED = 96;
  private static readonly BIRTH = 3;
  private static readonly SURVIVE = 2;
  private static readonly TONE = { hz: 1760, milliseconds: 30 };

  public readonly name = 'Conway (vida)';
  public readonly file = 'conway.ino';
  public readonly bytes = 272590;
  public readonly delay = { slow: 600, fast: 80 };
  public readonly source = [
    '#include "lab.h"  // lc (MAX7219), POT, BUZZER',
    '',
    'bool g[8][8], n[8][8];',
    'int gen = 0;',
    '',
    'int vecinas(int f, int c) {',
    '  int k = 0;',
    '  for (int i = -1; i <= 1; i++)',
    '    for (int j = -1; j <= 1; j++)',
    '      k += g[(f + i + 8) % 8][(c + j + 8) % 8];',
    '  return k - g[f][c];            // sin contarse a sí misma',
    '}',
    '',
    'void loop() {',
    '  int vivas = 0;',
    '  for (int f = 0; f < 8; f++)',
    '    for (int c = 0; c < 8; c++) {',
    '      int k = vecinas(f, c);',
    '      n[f][c] = k == 3 || (g[f][c] && k == 2);',
    '      vivas += n[f][c];',
    '      lc.setLed(0, f, c, n[f][c]);',
    '    }',
    '  bool quieto = !memcmp(g, n, sizeof g);',
    '  memcpy(g, n, sizeof g);',
    '  Serial.printf("gen %d  vivas %d\\n", ++gen, vivas);',
    '  if (!vivas || quieto || gen % 96 == 0) sembrar();',
    '  delay(map(analogRead(POT), 0, 4095, 600, 80));',
    '}',
    '',
    'void sembrar() {',
    '  for (int f = 0; f < 8; f++)',
    '    for (int c = 0; c < 8; c++) g[f][c] = random(3) == 0;',
    '  tone(BUZZER, 1760, 30);',
    '}',
    '',
    'void setup() {',
    '  Serial.begin(115200);',
    '  randomSeed(esp_random());',
    '  sembrar();',
    '}',
  ];

  private grid = new Uint8Array(LifeProgram.SIZE * LifeProgram.SIZE);
  private next = new Uint8Array(LifeProgram.SIZE * LifeProgram.SIZE);
  private generation = 0;

  /**
   * @inheritdoc
   */
  public setup(io: FirmwareIo): void {
    this.generation = 0;
    this.seed(io);
  }

  /**
   * @inheritdoc
   */
  public loop(io: FirmwareIo): void {
    let alive = 0;
    let still = true;
    for (let cell = 0; cell < this.grid.length; cell++) {
      const on = this.lives(cell);
      this.next[cell] = on ? 1 : 0;
      alive += this.next[cell] ?? 0;
      still &&= this.next[cell] === this.grid[cell];
      io.setLed(Math.floor(cell / LifeProgram.SIZE), cell % LifeProgram.SIZE, on);
    }
    [this.grid, this.next] = [this.next, this.grid];
    this.generation += 1;
    io.print(`gen ${String(this.generation)}  vivas ${String(alive)}`);
    if (alive === 0 || still || this.generation % LifeProgram.RESEED === 0) {
      this.seed(io);
    }
  }

  /**
   * Regla de Conway para una célula.
   *
   * @param cell Índice de la célula.
   * @returns Si vive en la generación siguiente.
   */
  private lives(cell: number): boolean {
    const neighbours = this.neighbours(cell);
    return neighbours === LifeProgram.BIRTH || (this.grid[cell] === 1 && neighbours === LifeProgram.SURVIVE);
  }

  /**
   * Vecinas vivas de una célula, con los bordes unidos (toro).
   *
   * @param cell Índice de la célula.
   * @returns Cantidad de vecinas vivas.
   */
  private neighbours(cell: number): number {
    const size = LifeProgram.SIZE;
    const row = Math.floor(cell / size);
    const column = cell % size;
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        count += this.grid[((row + i + size) % size) * size + ((column + j + size) % size)] ?? 0;
      }
    }
    return count - (this.grid[cell] ?? 0);
  }

  /**
   * Siembra el tablero al azar (una de cada tres células) y avisa con un pitido.
   *
   * @param io Hardware de la placa.
   */
  private seed(io: FirmwareIo): void {
    for (let cell = 0; cell < this.grid.length; cell++) {
      this.grid[cell] = io.random(LifeProgram.BIRTH) === 0 ? 1 : 0;
    }
    io.tone(LifeProgram.TONE.hz, LifeProgram.TONE.milliseconds);
  }
}
