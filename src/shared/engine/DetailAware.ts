/**
 * Pieza que puede ahorrar trabajo cuando se ve pequeña: con `false` deja de redibujar sus pantallas de canvas
 * (conserva la última imagen) y con `true` vuelve a dibujarlas. La avisa el {@link UpdateScheduler}.
 */
export interface DetailAware {
  /**
   * Avisa si la pieza se ve con suficiente detalle como para que valga la pena redibujar sus pantallas.
   *
   * @param detailed `true` si se ve grande en pantalla.
   */
  setDetailed(detailed: boolean): void;
}
