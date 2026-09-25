import type { RadioCarrier } from './RadioCarrier';
import type { RadioMode } from './RadioMode';

/**
 * Estado del receptor de radio del taller.
 */
export interface RadioState {
  /** Si está encendido. */
  readonly on: boolean;
  /** Modo de demodulación. */
  readonly mode: RadioMode;
  /** Frecuencia sintonizada en kHz. */
  readonly frequency: number;
  /** Posición del dial en la banda (0 = borde inferior, 1 = superior). */
  readonly dial: number;
  /** Mitad del ancho de banda del filtro en kHz. */
  readonly window: number;
  /** Extensión de la antena (0 = recogida, 1 = extendida). */
  readonly antenna: number;
  /** Largo de la antena en metros. */
  readonly antennaLength: number;
  /** Relación señal/ruido en dB (0 si solo hay ruido). */
  readonly snr: number;
  /** Emisora sintonizada, o `null`. */
  readonly station: RadioCarrier | null;
  /** Señal demodulada (0 a 1). */
  readonly signal: number;
  /** Si el control automático de frecuencia (AFC) está enganchado a la emisora. */
  readonly locked: boolean;
  /** Si está buscando la siguiente emisora. */
  readonly scanning: boolean;
  /** Si el squelch calla el ruido cuando no hay señal. */
  readonly squelch: boolean;
  /** Si la baliza sintonizada tiene la llave bajada (se oye el tono). */
  readonly keyed: boolean;
  /** Si el decodificador de morse está recibiendo. */
  readonly decoding: boolean;
  /** Texto decodificado hasta ahora. */
  readonly decoded: string;
  /** Puntos y rayas de la letra que se está recibiendo. */
  readonly pattern: string;
  /** Última letra reconocida con su patrón (p. ej. `.- = A`), o vacío. */
  readonly lastSymbol: string;
  /** Capacidad del capacitor variable del tanque LC en pF. */
  readonly capacitance: number;
}
