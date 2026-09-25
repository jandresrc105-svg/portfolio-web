/**
 * Navegación entre secciones sin scroll de página (patrón Observer): guarda la sección activa y avisa a
 * quien escuche cuando cambia. La vista general (`inicio`) es la parada 0; las demás siguen el orden de
 * las secciones del portafolio.
 */
export class SectionNavigator {
  public static readonly HOME = 'inicio';

  private stops: readonly string[] = [SectionNavigator.HOME];
  private index = 0;
  private readonly listeners = new Set<(sectionId: string) => void>();

  /**
   * Sección activa.
   *
   * @returns Id de la sección.
   */
  public get current(): string {
    return this.stops[this.index] ?? SectionNavigator.HOME;
  }

  /**
   * Posición de la sección activa en el recorrido (0 = vista general).
   *
   * @returns Índice de la parada.
   */
  public get position(): number {
    return this.index;
  }

  /**
   * Define las secciones del recorrido, en orden (sin la vista general, que siempre va primero).
   *
   * @param sectionIds Ids de las secciones.
   */
  public setStops(sectionIds: readonly string[]): void {
    this.stops = [SectionNavigator.HOME, ...sectionIds];
    this.index = Math.min(this.index, this.stops.length - 1);
  }

  /**
   * Va a una sección. Si ya está activa o no existe, no hace nada.
   *
   * @param sectionId Id de la sección destino.
   */
  public go(sectionId: string): void {
    const index = this.stops.indexOf(sectionId);
    if (index < 0 || index === this.index) {
      return;
    }
    this.index = index;
    this.listeners.forEach((listener) => {
      listener(this.current);
    });
  }

  /**
   * Avanza o retrocede paradas, sin salirse del recorrido.
   *
   * @param delta Paradas a moverse (negativo para retroceder).
   */
  public step(delta: number): void {
    const index = Math.min(Math.max(this.index + delta, 0), this.stops.length - 1);
    this.go(this.stops[index] ?? SectionNavigator.HOME);
  }

  /**
   * Vuelve a la vista general.
   */
  public home(): void {
    this.go(SectionNavigator.HOME);
  }

  /**
   * Suscribe un manejador a los cambios de sección.
   *
   * @param listener Recibe el id de la nueva sección activa.
   * @returns Función que cancela la suscripción.
   */
  public onChange(listener: (sectionId: string) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }
}
