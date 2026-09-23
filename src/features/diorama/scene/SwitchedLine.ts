import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../models/Powerable';

/**
 * Línea con interruptor delante de un elemento encendible (patrón Decorator), p. ej. la farola del poste
 * detrás del MAIN del tablero. La intro sigue fijando el nivel con `setPower`; abrir el interruptor apaga
 * de golpe y cerrarlo vuelve a encender con el parpadeo de un tubo que arranca.
 */
export class SwitchedLine implements Powerable, Updatable {
  private static readonly STRIKE = { duration: 0.8, fast: 41, slow: 7, threshold: 0.15, dim: 0.08 };

  private level = 0;
  private closed = true;
  private strike = 0;

  /**
   * Crea la línea.
   *
   * @param target Elemento alimentado por la línea.
   */
  public constructor(private readonly target: Powerable) {}

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.apply(1);
  }

  /**
   * Abre o cierra el interruptor.
   *
   * @param closed `true` para dar corriente.
   */
  public setClosed(closed: boolean): void {
    if (closed === this.closed) {
      return;
    }
    this.closed = closed;
    this.strike = closed ? SwitchedLine.STRIKE.duration : 0;
    this.apply(closed ? SwitchedLine.STRIKE.dim : 1);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    if (this.strike <= 0) {
      return;
    }
    this.strike -= delta;
    const { fast, slow, threshold, dim } = SwitchedLine.STRIKE;
    const noise = Math.sin(elapsed * fast) * Math.sin(elapsed * slow);
    this.apply(this.strike <= 0 || noise > threshold ? 1 : dim);
  }

  /**
   * Fija el nivel del elemento según el interruptor.
   *
   * @param factor Fracción del nivel (para el parpadeo).
   */
  private apply(factor: number): void {
    this.target.setPower(this.closed ? this.level * factor : 0);
  }
}
