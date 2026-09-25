/**
 * Arranque de un tubo de descarga (neón o fluorescente): unos destellos cortos antes de quedar encendido.
 * Es determinista: siempre el mismo patrón, contado desde {@link StrikePattern.start}.
 */
export class StrikePattern {
  private static readonly STEPS = [
    { at: 0, level: 0.8 },
    { at: 0.06, level: 0 },
    { at: 0.17, level: 0.55 },
    { at: 0.23, level: 0 },
    { at: 0.41, level: 1 },
    { at: 0.49, level: 0.2 },
    { at: 0.57, level: 1 },
  ];

  private time = Number.POSITIVE_INFINITY;

  /**
   * Empieza el arranque.
   */
  public start(): void {
    this.time = 0;
  }

  /**
   * Avanza el arranque un frame.
   *
   * @param delta Segundos desde el frame anterior.
   * @returns Multiplicador del brillo [0, 1] (1 cuando ya terminó).
   */
  public step(delta: number): number {
    this.time += delta;
    let level = 1;
    StrikePattern.STEPS.forEach((step) => {
      if (this.time >= step.at) {
        level = step.level;
      }
    });
    return level;
  }
}
