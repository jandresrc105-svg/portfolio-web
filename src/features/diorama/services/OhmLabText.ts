import type { OhmLabState } from '../models/OhmLabState';
import type { ResistorCode } from '../models/ResistorCode';

/**
 * Textos didácticos del circuito de la Ley de Ohm: unidades con prefijo, la fórmula con los números del
 * momento y el tooltip de cada control.
 */
export class OhmLabText {
  private static readonly THOUSAND = 1000;
  private static readonly FINE_MILLIAMPS = 10;
  private static readonly FINE_WATTS = 0.01;
  private static readonly DECIMALS = { ohms: 3, watts: 2, fine: 1 };

  /**
   * Resistencia con su prefijo (Ω o kΩ).
   *
   * @param value Ohmios.
   * @returns Texto.
   */
  public ohms(value: number): string {
    const kilo = value >= OhmLabText.THOUSAND;
    const shown = Number((kilo ? value / OhmLabText.THOUSAND : value).toFixed(OhmLabText.DECIMALS.ohms));
    return `${String(shown)} ${kilo ? 'kΩ' : 'Ω'}`;
  }

  /**
   * Corriente con su prefijo (mA o A).
   *
   * @param value Amperios.
   * @returns Texto.
   */
  public amps(value: number): string {
    const { fine } = OhmLabText.DECIMALS;
    if (value >= 1) {
      return `${value.toFixed(fine)} A`;
    }
    const milli = value * OhmLabText.THOUSAND;
    return milli >= OhmLabText.FINE_MILLIAMPS
      ? `${String(Math.round(milli))} mA`
      : `${milli.toFixed(fine)} mA`;
  }

  /**
   * Potencia con su prefijo (mW o W).
   *
   * @param value Vatios.
   * @returns Texto.
   */
  public watts(value: number): string {
    const { watts, fine } = OhmLabText.DECIMALS;
    return value >= OhmLabText.FINE_WATTS
      ? `${value.toFixed(watts)} W`
      : `${(value * OhmLabText.THOUSAND).toFixed(fine)} mW`;
  }

  /**
   * La Ley de Ohm con los valores del momento: `I = (9 V − 2 V) / 330 Ω = 21 mA`.
   *
   * @param state Estado del circuito.
   * @returns Fórmula.
   */
  public formula(state: OhmLabState): string {
    const { volts, forward, ohms, amps } = state;
    return `I = (${String(volts)} V − ${String(forward)} V) / ${this.ohms(ohms)} = ${this.amps(amps)}`;
  }

  /**
   * Tooltip de una perilla de la década.
   *
   * @param label Multiplicador de la perilla (×1k, ×100…).
   * @param digit Posición de la perilla.
   * @param state Estado del circuito.
   * @returns Texto.
   */
  public knob(label: string, digit: number, state: OhmLabState): string {
    return `Década ${label} en ${String(digit)} → R = ${this.ohms(state.ohms)} · Arrastra o haz clic`;
  }

  /**
   * Tooltip de la batería y su interruptor.
   *
   * @param state Estado del circuito.
   * @returns Texto.
   */
  public battery(state: OhmLabState): string {
    return state.closed
      ? `Batería de ${String(state.volts)} V · Abrir el interruptor`
      : `Batería de ${String(state.volts)} V · Cerrar el interruptor`;
  }

  /**
   * Tooltip del LED: la fórmula, o por qué no hay corriente.
   *
   * @param state Estado del circuito.
   * @returns Texto.
   */
  public led(state: OhmLabState): string {
    if (state.burnt) {
      return 'LED quemado · Clic para poner uno nuevo del cajón';
    }
    if (state.short) {
      return '¡Cortocircuito! Con R = 0 Ω nada limita la corriente';
    }
    if (!state.closed) {
      return 'LED rojo (Vf ≈ 2 V) · Circuito abierto: I = 0 mA';
    }
    const warning = state.amps > state.limit ? ` · ¡Más de ${this.amps(state.limit)}: se quema!` : '';
    return `${this.formula(state)}${warning}`;
  }

  /**
   * Tooltip del cajón de repuestos.
   *
   * @param state Estado del circuito.
   * @returns Texto.
   */
  public spares(state: OhmLabState): string {
    if (state.burnt) {
      return 'Cajón de LEDs · Cambiar el LED quemado';
    }
    return state.casualties > 0
      ? `Cajón de LEDs · Van ${String(state.casualties)} quemados`
      : 'Cajón de LEDs de repuesto · Ojalá no hagan falta';
  }

  /**
   * Tooltip de la resistencia gigante: su código de colores.
   *
   * @param code Código de colores.
   * @param state Estado del circuito.
   * @returns Texto.
   */
  public resistor(code: ResistorCode, state: OhmLabState): string {
    const [tolerance] = code.bands.slice(-1);
    const digits = code.bands.length > 1 ? code.bands.slice(0, -1) : code.bands;
    const names = digits.map(({ name }) => name).join('-');
    const base = `${names} = ${this.ohms(code.ohms)}`;
    const suffix = code.bands.length > 1 && tolerance ? ` · ${tolerance.name} = ±5 %` : ' (puente)';
    const note = code.exact ? '' : ` · Valor comercial E24 más cercano a ${this.ohms(state.ohms)}`;
    return `${base}${suffix}${note}`;
  }

  /**
   * Tooltip del panel de medición: la potencia en la resistencia y en el LED.
   *
   * @param state Estado del circuito.
   * @returns Texto.
   */
  public meter(state: OhmLabState): string {
    const led = state.amps * state.forward;
    const hot = state.watts > state.rating ? ' · ¡Más de ¼ W: la resistencia se calienta!' : '';
    return `Potencia en la resistencia: ${this.watts(state.watts)} · En el LED: ${this.watts(led)}${hot}`;
  }
}
