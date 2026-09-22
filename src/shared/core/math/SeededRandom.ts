/**
 * Generador pseudoaleatorio determinista (mulberry32).
 * Con la misma semilla produce siempre la misma secuencia, así la escena procedural es idéntica en cada visita.
 */
export class SeededRandom {
  private static readonly INCREMENT = 0x6d2b79f5;
  private static readonly SHIFT_A = 15;
  private static readonly SHIFT_B = 7;
  private static readonly SHIFT_C = 14;
  private static readonly MIX = 61;
  private static readonly UINT32_RANGE = 4294967296;

  private state: number;

  /**
   * Crea el generador.
   *
   * @param seed Semilla entera.
   */
  public constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Siguiente número en [0, 1).
   *
   * @returns Número pseudoaleatorio.
   */
  public next(): number {
    this.state = (this.state + SeededRandom.INCREMENT) | 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> SeededRandom.SHIFT_A), value | 1);
    value ^= value + Math.imul(value ^ (value >>> SeededRandom.SHIFT_B), value | SeededRandom.MIX);
    return ((value ^ (value >>> SeededRandom.SHIFT_C)) >>> 0) / SeededRandom.UINT32_RANGE;
  }

  /**
   * Número en el rango [min, max).
   *
   * @param min Límite inferior.
   * @param max Límite superior.
   * @returns Número pseudoaleatorio en el rango.
   */
  public range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /**
   * Elige un elemento de la lista.
   *
   * @param items Lista no vacía.
   * @returns Elemento elegido.
   * @throws {Error} Si la lista está vacía.
   */
  public pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) {
      throw new Error('No se puede elegir de una lista vacía');
    }
    return item;
  }
}
