import type { FirmwareIo } from '../../models/FirmwareIo';
import type { FirmwareProgram } from '../../models/FirmwareProgram';
import { SnakePathfinder } from './SnakePathfinder';

/**
 * "Snake autónomo": la serpiente juega sola. Busca el camino más corto a la comida con BFS; si no hay o si
 * ese paso la deja con menos espacio libre que su largo, va hacia la vecina con más espacio (flood fill). Si
 * queda encerrada, pierde y vuelve a empezar. Cada comida suma un punto, alarga la serpiente y pita.
 */
export class SnakeProgram implements FirmwareProgram {
  private static readonly SIZE = 8;
  private static readonly START = [{ cell: 26 }, { cell: 25 }, { cell: 24 }];
  private static readonly EAT = { hz: 1320, milliseconds: 40 };
  private static readonly LOSE = { hz: 196, milliseconds: 260 };

  public readonly name = 'Snake autónomo';
  public readonly file = 'snake.ino';
  public readonly bytes = 276031;
  public readonly delay = { slow: 350, fast: 60 };
  public readonly source = [
    '#include "lab.h"  // lc (MAX7219), POT, BUZZER',
    '',
    'Punto serpiente[64], comida;',
    'int largo = 3, puntos = 0;',
    '',
    'void loop() {',
    '  Punto cabeza = serpiente[0];',
    '  Punto paso = bfs(cabeza, comida);      // camino más corto',
    '  if (!paso.ok || espacio(paso) < largo)',
    '    paso = vecinaConMasEspacio(cabeza);  // flood fill',
    '  if (!paso.ok) return reiniciar();      // encerrada',
    '  memmove(serpiente + 1, serpiente, largo * sizeof(Punto));',
    '  serpiente[0] = paso;',
    '  if (paso == comida) {',
    '    largo++;',
    '    tone(BUZZER, 1320, 40);',
    '    Serial.printf("puntaje %d\\n", ++puntos);',
    '    comida = celdaLibreAlAzar();',
    '  }',
    '  dibujar();',
    '  delay(map(analogRead(POT), 0, 4095, 350, 60));',
    '}',
    '',
    'Punto bfs(Punto desde, Punto meta) {',
    '  Cola<Punto> cola;',
    '  Punto padre[8][8] = {};',
    '  cola.push(desde);',
    '  while (!cola.vacia()) {',
    '    Punto p = cola.pop();',
    '    if (p == meta) return primerPaso(padre, desde, meta);',
    '    for (Punto v : vecinas(p))',
    '      if (libre(v) && !padre[v.f][v.c].ok) {',
    '        padre[v.f][v.c] = p;',
    '        cola.push(v);',
    '      }',
    '  }',
    '  return {};                             // sin camino',
    '}',
  ];

  private readonly paths = new SnakePathfinder();
  private body: number[] = [];
  private food = 0;
  private score = 0;
  private blink = false;

  /**
   * @inheritdoc
   */
  public setup(io: FirmwareIo): void {
    this.body = SnakeProgram.START.map(({ cell }) => cell);
    this.score = 0;
    this.food = this.freeCell(io);
    io.print('snake: nueva partida');
  }

  /**
   * @inheritdoc
   */
  public loop(io: FirmwareIo): void {
    const step = this.choose();
    if (step < 0) {
      this.lose(io);
      return;
    }
    this.body.unshift(step);
    if (step === this.food) {
      this.eat(io);
    } else {
      this.body.pop();
    }
    this.draw(io);
  }

  /**
   * Elige el próximo paso: BFS a la comida y, si es peligroso o no existe, la vecina con más espacio.
   *
   * @returns Celda del paso, o -1 si está encerrada.
   */
  private choose(): number {
    const head = this.body[0] ?? 0;
    const blocked = new Set(this.body.slice(0, -1));
    const step = this.paths.firstStep(head, this.food, blocked);
    if (step >= 0 && this.paths.space(step, blocked) >= this.body.length) {
      return step;
    }
    return this.paths.roomiest(head, blocked);
  }

  /**
   * Come: suma un punto, pita y pone comida nueva (o gana si el tablero se llenó).
   *
   * @param io Hardware de la placa.
   */
  private eat(io: FirmwareIo): void {
    this.score += 1;
    io.tone(SnakeProgram.EAT.hz, SnakeProgram.EAT.milliseconds);
    io.print(`puntaje ${String(this.score)}`);
    if (this.body.length >= SnakeProgram.SIZE * SnakeProgram.SIZE) {
      io.print('¡tablero lleno!');
      this.setup(io);
      return;
    }
    this.food = this.freeCell(io);
  }

  /**
   * Pierde: avisa el puntaje final y empieza otra partida.
   *
   * @param io Hardware de la placa.
   */
  private lose(io: FirmwareIo): void {
    io.tone(SnakeProgram.LOSE.hz, SnakeProgram.LOSE.milliseconds);
    io.print(`encerrada · puntaje final ${String(this.score)}`);
    this.setup(io);
  }

  /**
   * Dibuja la serpiente y la comida (que parpadea).
   *
   * @param io Hardware de la placa.
   */
  private draw(io: FirmwareIo): void {
    io.clear();
    const size = SnakeProgram.SIZE;
    this.body.forEach((cell) => {
      io.setLed(Math.floor(cell / size), cell % size, true);
    });
    this.blink = !this.blink;
    io.setLed(Math.floor(this.food / size), this.food % size, this.blink);
  }

  /**
   * Celda libre al azar para la comida.
   *
   * @param io Hardware de la placa (para `random`).
   * @returns Celda libre.
   */
  private freeCell(io: FirmwareIo): number {
    const taken = new Set(this.body);
    const free: number[] = [];
    for (let cell = 0; cell < SnakeProgram.SIZE * SnakeProgram.SIZE; cell++) {
      if (!taken.has(cell)) {
        free.push(cell);
      }
    }
    return free[io.random(free.length)] ?? 0;
  }
}
