/**
 * Elemento que cambia entre la noche y el día (luces del cielo, fondo, haces de luz).
 */
export interface DaylightAware {
  /**
   * Fija el momento del día.
   *
   * @param level 0 = noche, 1 = día (los valores intermedios son el amanecer o el atardecer).
   */
  setDaylight(level: number): void;
}
