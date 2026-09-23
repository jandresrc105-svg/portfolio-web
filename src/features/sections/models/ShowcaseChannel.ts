/**
 * Eventos con los que una vitrina habla con su objeto de la escena 3D: la máquina expendedora (tecnologías),
 * el banco del taller (proyectos) o el tablero del poste (trayectoria).
 */
export interface ShowcaseChannel {
  /** Evento que publica la vitrina al mostrar un elemento. */
  readonly selected: 'showcaseSelected' | 'benchSelected' | 'timelineSelected';
  /** Evento que llega cuando el visitante elige un elemento desde la escena. */
  readonly picked: 'showcasePicked' | 'benchPicked' | 'timelinePicked';
  /** Texto accesible del grupo. */
  readonly label: string;
}
