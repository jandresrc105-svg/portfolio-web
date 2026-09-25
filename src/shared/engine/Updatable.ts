/**
 * Objeto que se actualiza en cada frame del {@link RenderLoop} (suscriptor del patrón Observer).
 */
export interface Updatable {
  /**
   * Avanza el estado del objeto un frame.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde que inició el loop.
   */
  update(delta: number, elapsed: number): void;
}
