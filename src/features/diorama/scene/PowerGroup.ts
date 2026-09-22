import type { Powerable } from '../models/Powerable';

/**
 * Grupo de elementos que se encienden juntos (patrón Composite), p. ej. una farola y su haz de luz,
 * para que parpadeen exactamente sincronizados.
 */
export class PowerGroup implements Powerable {
  private readonly members: Powerable[];

  /**
   * Crea el grupo.
   *
   * @param members Elementos que comparten el mismo nivel de energía.
   */
  public constructor(...members: Powerable[]) {
    this.members = members;
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.members.forEach((member) => {
      member.setPower(level);
    });
  }
}
