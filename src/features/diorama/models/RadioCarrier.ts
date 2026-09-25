import type { RadioMode } from './RadioMode';

/**
 * Emisora simulada de la banda de 40 m: una portadora en una frecuencia fija.
 */
export interface RadioCarrier {
  /** Frecuencia de la portadora en kHz. */
  readonly frequency: number;
  /** Modo en que transmite. */
  readonly mode: RadioMode;
  /** Intensidad relativa (0 a 1) con la antena extendida por completo. */
  readonly power: number;
  /** Indicativo o nombre de la emisora. */
  readonly label: string;
  /** Mensaje que repite en morse (solo CW). */
  readonly message: string;
  /** Notas de la melodía que transmite (solo AM). */
  readonly notes: readonly { readonly hz: number }[];
}
