import type { DayPhase } from './DayPhase';
import type { ThemeMode } from './ThemeMode';

/**
 * Apariencia vigente.
 */
export interface ThemeState {
  /** Modo elegido por el visitante. */
  readonly mode: ThemeMode;
  /** Momento del día que se muestra (el del modo, o el de la hora local). */
  readonly phase: DayPhase;
}
