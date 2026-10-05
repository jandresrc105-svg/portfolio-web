import { ThemeMode } from './ThemeMode';
import type { ThemeState } from './ThemeState';
import type { ThemeStore } from './ThemeStore';

/**
 * Apariencia de la página (patrón Observer): guarda el modo que eligió el visitante y decide si se muestra de
 * día o de noche. En el modo de hora local es de día entre las 7:00 y las 19:00 de su reloj; quien muestre la
 * apariencia llama a {@link ThemeService.refresh} de vez en cuando para que el cambio llegue solo.
 */
export class ThemeService {
  private static readonly DAY_HOURS = { from: 7, until: 19 };

  private mode: ThemeMode;
  private day: boolean;
  private readonly listeners = new Set<(state: ThemeState) => void>();

  /**
   * Crea el servicio con el modo guardado.
   *
   * @param store Almacén del modo elegido.
   * @param clock Hora actual (se inyecta para poder probarlo).
   */
  public constructor(
    private readonly store: ThemeStore,
    private readonly clock: () => Date = (): Date => new Date(),
  ) {
    this.mode = store.load();
    this.day = this.resolveDay();
  }

  /**
   * Apariencia vigente.
   *
   * @returns Modo y si es de día.
   */
  public get state(): ThemeState {
    return { mode: this.mode, day: this.day };
  }

  /**
   * Avisa cada vez que cambia el modo o el momento del día (y de inmediato con el estado actual).
   *
   * @param listener Recibe la apariencia vigente.
   * @returns Función para dejar de escuchar.
   */
  public onChange(listener: (state: ThemeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Elige un modo y lo recuerda.
   *
   * @param mode Modo elegido.
   */
  public setMode(mode: ThemeMode): void {
    if (mode === this.mode) {
      return;
    }
    this.mode = mode;
    this.store.save(mode);
    this.day = this.resolveDay();
    this.notify();
  }

  /**
   * Vuelve a mirar la hora: en el modo de hora local, avisa si pasó de día a noche o al revés.
   */
  public refresh(): void {
    const day = this.resolveDay();
    if (day !== this.day) {
      this.day = day;
      this.notify();
    }
  }

  /**
   * Si corresponde mostrar el día con el modo actual.
   *
   * @returns `true` si es de día.
   */
  private resolveDay(): boolean {
    if (this.mode !== ThemeMode.Local) {
      return this.mode === ThemeMode.Light;
    }
    const hour = this.clock().getHours();
    const { from, until } = ThemeService.DAY_HOURS;
    return hour >= from && hour < until;
  }

  /**
   * Avisa a quienes escuchan.
   */
  private notify(): void {
    const state = this.state;
    this.listeners.forEach((listener) => {
      listener(state);
    });
  }
}
