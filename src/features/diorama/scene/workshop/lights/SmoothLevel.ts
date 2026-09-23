/**
 * Nivel que se acerca suavemente a su objetivo (fundido exponencial independiente de los FPS), para
 * encender y apagar luces sin saltos.
 */
export class SmoothLevel {
  private current: number;
  private target: number;

  /**
   * Crea el nivel.
   *
   * @param initial Valor inicial (también es el objetivo).
   * @param rate Rapidez del fundido (1/s): más alto, más rápido.
   */
  public constructor(
    initial: number,
    private readonly rate: number,
  ) {
    this.current = initial;
    this.target = initial;
  }

  /**
   * Valor actual.
   *
   * @returns Nivel.
   */
  public get value(): number {
    return this.current;
  }

  /**
   * Fija el objetivo.
   *
   * @param target Nivel al que se va.
   */
  public set(target: number): void {
    this.target = target;
  }

  /**
   * Avanza el fundido un frame.
   *
   * @param delta Segundos desde el frame anterior.
   * @returns Valor actual.
   */
  public step(delta: number): number {
    this.current += (this.target - this.current) * (1 - Math.exp(-this.rate * delta));
    return this.current;
  }
}
