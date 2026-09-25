/**
 * Bus de eventos tipado (patrón Observer / Mediator).
 * Permite que features independientes se comuniquen sin importarse entre sí.
 */
export class EventBus<TEvents extends object> {
  private readonly handlers = new Map<keyof TEvents, Set<(payload: never) => void>>();

  /**
   * Suscribe un manejador a un evento.
   *
   * @param event Nombre del evento.
   * @param handler Manejador que recibe la carga del evento.
   * @returns Función que cancela la suscripción.
   */
  public on<K extends keyof TEvents>(event: K, handler: (payload: TEvents[K]) => void): () => void {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
    return (): void => {
      handlers.delete(handler);
    };
  }

  /**
   * Publica un evento a todos sus suscriptores.
   *
   * @param event Nombre del evento.
   * @param payload Carga del evento.
   */
  public emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.handlers.get(event)?.forEach((handler) => {
      (handler as (value: TEvents[K]) => void)(payload);
    });
  }
}
