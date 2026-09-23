/**
 * Estado del circuito de la Ley de Ohm: batería de 9 V, interruptor, década de resistencias y LED rojo en
 * serie.
 */
export interface OhmLabState {
  /** Posición de cada perilla de la década (0–9), de ×1k a ×1. */
  readonly digits: readonly number[];
  /** Resistencia elegida en la década, en ohmios. */
  readonly ohms: number;
  /** Si el interruptor de la batería cierra el circuito. */
  readonly closed: boolean;
  /** Si el LED está quemado (circuito abierto hasta reemplazarlo). */
  readonly burnt: boolean;
  /** Si hay cortocircuito: circuito cerrado con la década en 0 Ω. */
  readonly short: boolean;
  /** Voltaje de la batería. */
  readonly volts: number;
  /** Caída de voltaje en el LED encendido. */
  readonly forward: number;
  /** Corriente que circula, en amperios. */
  readonly amps: number;
  /** Corriente máxima que aguanta el LED, en amperios. */
  readonly limit: number;
  /** Potencia que disipa la resistencia, en vatios. */
  readonly watts: number;
  /** Potencia que aguanta una resistencia común de ¼ W. */
  readonly rating: number;
  /** Brillo relativo del LED (1 = corriente nominal). */
  readonly brightness: number;
  /** Avance hacia la quemadura por sobrecorriente (0 = a salvo, 1 = se quema). */
  readonly stress: number;
  /** LEDs quemados desde que se abrió la página. */
  readonly casualties: number;
}
