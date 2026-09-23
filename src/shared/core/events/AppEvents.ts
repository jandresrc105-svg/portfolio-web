import type { ContactChannel } from './ContactChannel';
import type { TimelineDirectory } from './TimelineDirectory';

/**
 * Catálogo de eventos de la aplicación y el tipo de su carga.
 */
export interface AppEvents {
  /** La secuencia de encendido terminó: la escena y el contenido ya son interactivos. */
  readonly introComplete: undefined;
  /** El visitante eligió un elemento de la vitrina (índice desde 0). */
  readonly showcaseSelected: number;
  /** La vitrina se montó: sabor de la lata (tecnología) de cada uno de sus elementos, en orden. */
  readonly showcaseCans: readonly string[];
  /** El visitante hizo clic sobre una lata de la vitrina en la escena 3D (índice desde 0). */
  readonly showcasePicked: number;
  /** La sección de contacto se montó: canales del marcado rápido del teléfono (la tecla `i + 1` llama al `i`). */
  readonly contactChannels: readonly ContactChannel[];
  /** El visitante eligió una etapa de la trayectoria (índice desde 0). */
  readonly timelineSelected: number;
  /** La trayectoria se montó: breakers, sellos y fecha del medidor del tablero del poste. */
  readonly timelineDirectory: TimelineDirectory;
  /** El visitante subió un breaker del tablero en la escena 3D (índice de la etapa desde 0). */
  readonly timelinePicked: number;
  /** Los proyectos se montaron: etiqueta serigrafiada de la placa de cada uno, en orden. */
  readonly benchBoards: readonly string[];
  /** El visitante eligió un proyecto en la vitrina (índice desde 0). */
  readonly benchSelected: number;
  /** El visitante llevó una placa al banco del taller en la escena 3D (índice del proyecto desde 0). */
  readonly benchPicked: number;
}
