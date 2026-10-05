/**
 * Fotocelda de una lámpara de la calle (farola y su haz): la enciende del todo desde la tarde hasta la noche y la
 * va apagando a medida que avanza el día.
 */
export class PhotoCell {
  private static readonly DUSK = 0.5;

  /**
   * Cuánto deja encendida la lámpara en un momento del día.
   *
   * @param level Momento del día (0 = noche, 0,5 = tarde, 1 = día).
   * @returns Factor de encendido [0, 1].
   */
  public lamp(level: number): number {
    return Math.min(Math.max((1 - level) / (1 - PhotoCell.DUSK), 0), 1);
  }
}
