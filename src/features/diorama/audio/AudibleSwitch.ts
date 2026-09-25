import type { Powerable } from '../models/Powerable';

/**
 * Decorador de {@link Powerable} (patrón Decorator): reenvía el nivel de energía al elemento
 * y dispara un sonido en cada flanco de subida, como el arrancador de un tubo al destellar.
 */
export class AudibleSwitch implements Powerable {
  private static readonly THRESHOLD = 0.5;

  private last = 0;

  /**
   * Envuelve un elemento encendible.
   *
   * @param target Elemento real.
   * @param onRise Acción a ejecutar en cada flanco de subida.
   */
  public constructor(
    private readonly target: Powerable,
    private readonly onRise: () => void,
  ) {}

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    if (level >= AudibleSwitch.THRESHOLD && this.last < AudibleSwitch.THRESHOLD) {
      this.onRise();
    }
    this.last = level;
    this.target.setPower(level);
  }
}
