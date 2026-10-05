/**
 * Modo de apariencia que elige el visitante: claro (de día), tarde (al atardecer), oscuro (de noche) o según
 * la hora local.
 */
export enum ThemeMode {
  /** Claro: el diorama de día y la interfaz clara. */
  Light = 'light',
  /** Tarde: el diorama al atardecer y la interfaz oscura. */
  Dusk = 'dusk',
  /** Oscuro: el diorama de noche y la interfaz oscura. */
  Dark = 'dark',
  /** Según la hora local del visitante: de día, de tarde o de noche. */
  Local = 'local',
}
