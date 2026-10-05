/**
 * Modo de apariencia que elige el visitante: día, tarde (al atardecer), noche o según
 * la hora local.
 */
export enum ThemeMode {
  /** Día: el diorama a pleno sol y la interfaz clara. */
  Light = 'light',
  /** Tarde: el diorama al atardecer y la interfaz oscura. */
  Dusk = 'dusk',
  /** Noche: el diorama con los neones y la interfaz oscura. */
  Dark = 'dark',
  /** Según la hora local del visitante: de día, de tarde o de noche. */
  Local = 'local',
}
