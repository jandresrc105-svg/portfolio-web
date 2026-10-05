/**
 * Parte del ramen que acompaña el cierre o la apertura del local (el cocinero, el noren y la cortina).
 */
export interface ShopFixture {
  /**
   * Fija cuánto avanzó el cierre.
   *
   * @param progress 0 = abierto, 1 = cerrado (al abrir va de 1 a 0: el mismo guion al revés).
   */
  setClosure(progress: number): void;
}
