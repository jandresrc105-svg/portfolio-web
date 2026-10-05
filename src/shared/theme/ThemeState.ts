import type { ThemeMode } from './ThemeMode';

/**
 * Apariencia vigente.
 */
export interface ThemeState {
  /** Modo elegido por el visitante. */
  readonly mode: ThemeMode;
  /** Si se muestra de día (modo claro, o la hora local cae de día). */
  readonly day: boolean;
}
