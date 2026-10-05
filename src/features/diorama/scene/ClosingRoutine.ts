/**
 * Guion del cierre del ramen (y, al revés, de la apertura), como una sola línea de tiempo de 0 (abierto) a 1
 * (cerrado): el cocinero deja la olla y camina hasta la barra, estira los brazos al frente mientras se enrolla el
 * noren, bajan las cortinas de los costados y él baja la del frente con la correa (las luces del local se apagan
 * mientras baja) y vuelve a la olla a seguir
 * preparando. Cada parte del local lee de aquí cuánto avanzó su tramo.
 */
export class ClosingRoutine {
  /** Segundos que dura el cierre (o la apertura) completo. */
  public static readonly SECONDS = 9;

  private static readonly STEPS = {
    out: { from: 0.02, to: 0.24 },
    noren: { from: 0.26, to: 0.4 },
    sides: { from: 0.3, to: 0.56 },
    pull: { from: 0.42, to: 0.72 },
    lights: { from: 0.5, to: 0.72 },
    back: { from: 0.76, to: 0.98 },
  };

  /**
   * Cuánto camino hizo de la olla a la barra.
   *
   * @param progress Avance del cierre.
   * @returns [0, 1].
   */
  public out(progress: number): number {
    return ClosingRoutine.span(progress, ClosingRoutine.STEPS.out);
  }

  /**
   * Cuánto está enrollado el noren.
   *
   * @param progress Avance del cierre.
   * @returns [0, 1].
   */
  public noren(progress: number): number {
    return ClosingRoutine.ease(ClosingRoutine.span(progress, ClosingRoutine.STEPS.noren));
  }

  /**
   * Cuánto bajaron las cortinas de los costados (bajan solas, un poco antes que la del frente).
   *
   * @param progress Avance del cierre.
   * @returns [0, 1].
   */
  public sides(progress: number): number {
    return ClosingRoutine.ease(ClosingRoutine.span(progress, ClosingRoutine.STEPS.sides));
  }

  /**
   * Cuánto bajó la cortina.
   *
   * @param progress Avance del cierre.
   * @returns [0, 1].
   */
  public pull(progress: number): number {
    return ClosingRoutine.ease(ClosingRoutine.span(progress, ClosingRoutine.STEPS.pull));
  }

  /**
   * Cuánto se apagaron las luces del local.
   *
   * @param progress Avance del cierre.
   * @returns [0, 1].
   */
  public lights(progress: number): number {
    return ClosingRoutine.ease(ClosingRoutine.span(progress, ClosingRoutine.STEPS.lights));
  }

  /**
   * Cuánto camino hizo de vuelta de la barra a la olla.
   *
   * @param progress Avance del cierre.
   * @returns [0, 1].
   */
  public back(progress: number): number {
    return ClosingRoutine.span(progress, ClosingRoutine.STEPS.back);
  }

  /**
   * Cuánto está de cada tarea de manos: 1 en medio de enrollar el noren o de bajar la cortina, 0 lejos de ellas
   * (con una entrada y una salida suaves).
   *
   * @param progress Avance del cierre.
   * @param step Tarea (`noren` o `pull`).
   * @returns [0, 1].
   */
  public hands(progress: number, step: 'noren' | 'pull'): number {
    const { from, to } = ClosingRoutine.STEPS[step];
    const margin = ClosingRoutine.STEPS.noren.from - ClosingRoutine.STEPS.out.to;
    const rise = ClosingRoutine.ease(ClosingRoutine.span(progress, { from: from - margin * 2, to: from }));
    const fall = ClosingRoutine.ease(ClosingRoutine.span(progress, { from: to, to: to + margin * 2 }));
    return rise * (1 - fall);
  }

  /**
   * Avance dentro de un tramo.
   *
   * @param progress Avance del cierre.
   * @param step Tramo.
   * @param step.from Inicio.
   * @param step.to Fin.
   * @returns [0, 1].
   */
  private static span(progress: number, step: { from: number; to: number }): number {
    return Math.min(Math.max((progress - step.from) / (step.to - step.from), 0), 1);
  }

  /**
   * Curva suave.
   *
   * @param t Entrada [0, 1].
   * @returns Salida [0, 1].
   */
  private static ease(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
