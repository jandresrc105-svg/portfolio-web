import { DayPhase } from './DayPhase';
import { ThemeMode } from './ThemeMode';
import type { ThemeState } from './ThemeState';
import type { ThemeStore } from './ThemeStore';

/**
 * Apariencia de la página (patrón Observer): guarda el modo que eligió el visitante y decide qué momento del
 * día se muestra. En el modo de hora local, según su reloj, es de día de 7:00 a 17:00, de tarde de 17:00 a
 * 19:00 y de noche el resto; quien muestre la apariencia llama a {@link ThemeService.refresh} de vez en cuando
 * para que el cambio llegue solo.
 */
export class ThemeService {
  private static readonly HOURS = { morning: 7, afternoon: 17, evening: 19 };
  private static readonly FIXED: ReadonlyMap<ThemeMode, DayPhase> = new Map([
    [ThemeMode.Light, DayPhase.Day],
    [ThemeMode.Dusk, DayPhase.Dusk],
    [ThemeMode.Dark, DayPhase.Night],
  ]);

  private mode: ThemeMode;
  private phase: DayPhase;
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
    this.phase = this.resolvePhase();
  }

  /**
   * Apariencia vigente.
   *
   * @returns Modo y momento del día.
   */
  public get state(): ThemeState {
    return { mode: this.mode, phase: this.phase };
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
    this.phase = this.resolvePhase();
    this.notify();
  }

  /**
   * Vuelve a mirar la hora: en el modo de hora local, avisa si cambió el momento del día.
   */
  public refresh(): void {
    const phase = this.resolvePhase();
    if (phase !== this.phase) {
      this.phase = phase;
      this.notify();
    }
  }

  /**
   * Momento del día del modo actual.
   *
   * @returns Momento del día.
   */
  private resolvePhase(): DayPhase {
    const fixed = ThemeService.FIXED.get(this.mode);
    if (fixed) {
      return fixed;
    }
    const hour = this.clock().getHours();
    const { morning, afternoon, evening } = ThemeService.HOURS;
    if (hour >= morning && hour < afternoon) {
      return DayPhase.Day;
    }
    return hour >= afternoon && hour < evening ? DayPhase.Dusk : DayPhase.Night;
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
