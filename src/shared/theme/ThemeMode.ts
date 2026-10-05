/**
 * Modo de apariencia que elige el visitante: claro (de día), oscuro (de noche) o según la hora local.
 */
export enum ThemeMode {
  /** Claro: el diorama de día y la interfaz clara. */
  Light = 'light',
  /** Oscuro: el diorama de noche y la interfaz oscura. */
  Dark = 'dark',
  /** Según la hora local del visitante: de día claro, de noche oscuro. */
  Local = 'local',
}
