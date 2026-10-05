import type { Powerable } from '../models/Powerable';

/**
 * Interruptor del local entre la red de la calle y una luz del ramen (patrón Decorator): la luz recibe la energía
 * de su línea (la que enciende la intro y corta el MAIN del poste) por la apertura del local, así que de día,
 * con el ramen cerrado, queda apagada aunque haya red.
 */
export class ShopSwitch implements Powerable {
  private level = 0;
  private open = 1;

  /**
   * Conecta una luz del local.
   *
   * @param target Luz.
   */
  public constructor(private readonly target: Powerable) {}

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.apply();
  }

  /**
   * Fija cuánto está abierto el local.
   *
   * @param open 0 = cerrado, 1 = abierto.
   */
  public setOpen(open: number): void {
    this.open = open;
    this.apply();
  }

  /**
   * Pasa a la luz la energía de la red por la apertura del local.
   */
  private apply(): void {
    this.target.setPower(this.level * this.open);
  }
}
