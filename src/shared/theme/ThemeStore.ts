import { ThemeMode } from './ThemeMode';

/**
 * Recuerda el modo de apariencia elegido entre visitas (en el almacenamiento del navegador). Si el
 * almacenamiento no está disponible (navegación privada, bloqueado), se usa la hora local y no se guarda nada.
 */
export class ThemeStore {
  private static readonly KEY = 'jr-portfolio-theme';
  private static readonly MODES: readonly string[] = Object.values(ThemeMode);

  /**
   * Modo guardado.
   *
   * @returns Modo, o la hora local si no hay uno válido.
   */
  public load(): ThemeMode {
    try {
      const stored = localStorage.getItem(ThemeStore.KEY);
      return stored !== null && ThemeStore.MODES.includes(stored) ? (stored as ThemeMode) : ThemeMode.Local;
    } catch {
      return ThemeMode.Local;
    }
  }

  /**
   * Guarda el modo, ignorando fallos del almacenamiento.
   *
   * @param mode Modo elegido.
   */
  public save(mode: ThemeMode): void {
    try {
      localStorage.setItem(ThemeStore.KEY, mode);
    } catch {
      return;
    }
  }
}
