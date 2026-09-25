/**
 * Ciclo del semáforo de la esquina: una tabla de fases (verde, amarillo y rojo para los carros; siga, siga
 * intermitente y pare para los peatones) que se recorre con el tiempo. Solo dice qué luz va encendida; el
 * semáforo decide cómo se ve.
 */
export class SignalCycle {
  public static readonly CAR_GREEN = 0;
  public static readonly CAR_YELLOW = 1;
  public static readonly CAR_RED = 2;

  private static readonly PHASES = [
    { car: SignalCycle.CAR_GREEN, walk: false, blink: false, duration: 9 },
    { car: SignalCycle.CAR_YELLOW, walk: false, blink: false, duration: 2.5 },
    { car: SignalCycle.CAR_RED, walk: false, blink: false, duration: 1.2 },
    { car: SignalCycle.CAR_RED, walk: true, blink: false, duration: 7 },
    { car: SignalCycle.CAR_RED, walk: true, blink: true, duration: 3 },
    { car: SignalCycle.CAR_RED, walk: false, blink: false, duration: 1.5 },
  ];
  private static readonly BLINK_RATE = 2.5;

  private phase = 0;
  private timer = 0;

  /**
   * Luz encendida del semáforo de los carros.
   *
   * @returns Índice de la luz (`CAR_GREEN`, `CAR_YELLOW` o `CAR_RED`).
   */
  public get car(): number {
    return this.current.car;
  }

  /**
   * Si los peatones tienen el siga fijo (el momento en que suena el aviso de cruce).
   *
   * @returns `true` durante el siga sin parpadeo.
   */
  public get crossing(): boolean {
    return this.current.walk && !this.current.blink;
  }

  /**
   * Fase actual.
   *
   * @returns Fase de la tabla.
   */
  private get current(): { car: number; walk: boolean; blink: boolean; duration: number } {
    return SignalCycle.PHASES[this.phase] ?? SignalCycle.PHASES[0] ?? SignalCycle.fallback();
  }

  /**
   * Avanza el ciclo.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    this.timer += delta;
    while (this.timer >= this.current.duration) {
      this.timer -= this.current.duration;
      this.phase = (this.phase + 1) % SignalCycle.PHASES.length;
    }
  }

  /**
   * Si el muñeco verde (siga) está encendido; en la fase intermitente parpadea.
   *
   * @param elapsed Segundos desde el inicio.
   * @returns `true` si está encendido.
   */
  public walkLit(elapsed: number): boolean {
    const { walk, blink } = this.current;
    return walk && (!blink || Math.sin(elapsed * Math.PI * 2 * SignalCycle.BLINK_RATE) > 0);
  }

  /**
   * Si el muñeco rojo (pare) está encendido.
   *
   * @returns `true` si está encendido.
   */
  public stopLit(): boolean {
    return !this.current.walk;
  }

  /**
   * Fase de respaldo si la tabla estuviera vacía.
   *
   * @returns Fase en rojo para todos.
   */
  private static fallback(): { car: number; walk: boolean; blink: boolean; duration: number } {
    return { car: SignalCycle.CAR_RED, walk: false, blink: false, duration: 1 };
  }
}
