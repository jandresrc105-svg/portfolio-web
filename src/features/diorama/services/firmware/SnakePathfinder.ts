/**
 * Búsqueda de caminos del Snake autónomo sobre la cuadrícula de 8×8 (sin bordes que se unan): búsqueda en
 * anchura (BFS) para el camino más corto y relleno por inundación (flood fill) para medir el espacio libre.
 * Las celdas se numeran fila × 8 + columna.
 */
export class SnakePathfinder {
  private static readonly SIZE = 8;
  private static readonly DIRECTIONS = [
    { row: -1, column: 0 },
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 0, column: -1 },
  ];

  /**
   * Primer paso del camino más corto entre dos celdas (BFS).
   *
   * @param from Celda de salida.
   * @param goal Celda de llegada.
   * @param blocked Celdas ocupadas.
   * @returns Celda del primer paso, o -1 si no hay camino.
   */
  public firstStep(from: number, goal: number, blocked: ReadonlySet<number>): number {
    const parent = new Map<number, number>([[from, from]]);
    const queue = [from];
    for (const cell of queue) {
      if (cell === goal) {
        return SnakePathfinder.backtrack(parent, from, goal);
      }
      this.free(cell, blocked).forEach((next) => {
        if (!parent.has(next)) {
          parent.set(next, cell);
          queue.push(next);
        }
      });
    }
    return -1;
  }

  /**
   * Celdas libres que se alcanzan desde una celda (flood fill), contándola a ella.
   *
   * @param from Celda de salida.
   * @param blocked Celdas ocupadas.
   * @returns Cantidad de celdas alcanzables.
   */
  public space(from: number, blocked: ReadonlySet<number>): number {
    const seen = new Set([from]);
    const stack = [from];
    while (stack.length > 0) {
      const cell = stack.pop() ?? from;
      this.free(cell, blocked).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      });
    }
    return seen.size;
  }

  /**
   * Vecina libre con más espacio alrededor (la jugada más segura cuando no hay camino a la comida).
   *
   * @param from Celda actual.
   * @param blocked Celdas ocupadas.
   * @returns Celda elegida, o -1 si está encerrada.
   */
  public roomiest(from: number, blocked: ReadonlySet<number>): number {
    let best = -1;
    let room = 0;
    this.free(from, blocked).forEach((next) => {
      const size = this.space(next, blocked);
      if (size > room) {
        room = size;
        best = next;
      }
    });
    return best;
  }

  /**
   * Vecinas libres de una celda dentro del tablero.
   *
   * @param cell Celda.
   * @param blocked Celdas ocupadas.
   * @returns Vecinas libres.
   */
  public free(cell: number, blocked: ReadonlySet<number>): number[] {
    const size = SnakePathfinder.SIZE;
    const row = Math.floor(cell / size);
    const column = cell % size;
    return SnakePathfinder.DIRECTIONS.map((step) => ({ row: row + step.row, column: column + step.column }))
      .filter((next) => SnakePathfinder.inside(next.row) && SnakePathfinder.inside(next.column))
      .map((next) => next.row * size + next.column)
      .filter((next) => !blocked.has(next));
  }

  /**
   * Recorre los padres hacia atrás desde la meta hasta encontrar el paso que sale del origen.
   *
   * @param parent Padre de cada celda visitada.
   * @param from Origen.
   * @param goal Meta.
   * @returns Primer paso.
   */
  private static backtrack(parent: ReadonlyMap<number, number>, from: number, goal: number): number {
    let cell = goal;
    while (parent.get(cell) !== from && cell !== from) {
      cell = parent.get(cell) ?? from;
    }
    return cell;
  }

  /**
   * Indica si una fila o columna está dentro del tablero.
   *
   * @param index Fila o columna.
   * @returns `true` si está dentro.
   */
  private static inside(index: number): boolean {
    return index >= 0 && index < SnakePathfinder.SIZE;
  }
}
