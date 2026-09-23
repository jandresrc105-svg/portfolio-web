import type { Updatable } from '@shared/engine/Updatable';
import type { OhmLabEvent } from '../models/OhmLabEvent';
import type { OhmLabState } from '../models/OhmLabState';
import type { ResistorCode } from '../models/ResistorCode';
import { OhmLabText } from './OhmLabText';
import { ResistorColorCode } from './ResistorColorCode';

/**
 * Circuito de la Ley de Ohm (estado + Observer): batería de 9 V con interruptor, década de resistencias de
 * cuatro perillas y un LED rojo en serie. Calcula `I = (V − Vf) / R`; si la corriente pasa de 40 mA por un
 * instante el LED se quema y el circuito queda abierto hasta cambiarlo. Los controles se identifican con
 * `knob-<índice>` (0 = ×1k … 3 = ×1), `switch`, `led`, `spares`, `resistor` y `meter`.
 */
export class OhmLabService implements Updatable {
  public static readonly SWITCH = 'switch';
  public static readonly LED = 'led';
  public static readonly SPARES = 'spares';
  public static readonly RESISTOR = 'resistor';
  public static readonly METER = 'meter';
  public static readonly WEIGHTS = [
    { ohms: 1000, label: '×1k' },
    { ohms: 100, label: '×100' },
    { ohms: 10, label: '×10' },
    { ohms: 1, label: '×1' },
  ];
  public static readonly STEPS = 10;

  private static readonly KNOB = 'knob-';
  private static readonly CIRCUIT = { volts: 9, forward: 2, internal: 1.5, rating: 0.25 };
  private static readonly LED_RATING = { limit: 0.04, nominal: 0.02, burnSeconds: 0.45 };
  private static readonly START = [{ digit: 0 }, { digit: 3 }, { digit: 3 }, { digit: 0 }];
  private static readonly STEP_PIXELS = 22;

  private readonly listeners = new Set<(event: OhmLabEvent) => void>();
  private readonly digits = OhmLabService.START.map(({ digit }) => digit);
  private readonly code = new ResistorColorCode();
  private readonly text = new OhmLabText();
  private readonly tooltips: Readonly<Record<string, () => string>> = {
    [OhmLabService.SWITCH]: (): string => this.text.battery(this.state),
    [OhmLabService.LED]: (): string => this.text.led(this.state),
    [OhmLabService.SPARES]: (): string => this.text.spares(this.state),
    [OhmLabService.RESISTOR]: (): string => this.text.resistor(this.resistor, this.state),
    [OhmLabService.METER]: (): string => this.text.meter(this.state),
  };
  private closed = true;
  private burnt = false;
  private stress = 0;
  private casualties = 0;

  /**
   * Estado actual del circuito.
   *
   * @returns Estado.
   */
  public get state(): OhmLabState {
    const ohms = this.ohms;
    const { closed, burnt, stress, casualties } = this;
    return {
      ...this.electrical(ohms),
      digits: [...this.digits],
      closed,
      burnt,
      short: closed && ohms === 0,
      stress,
      casualties,
    };
  }

  /**
   * Código de colores de la resistencia elegida (llevada al valor normalizado más cercano).
   *
   * @returns Código de 4 bandas.
   */
  public get resistor(): ResistorCode {
    return this.code.encode(this.ohms);
  }

  /**
   * Resistencia elegida en la década.
   *
   * @returns Ohmios.
   */
  private get ohms(): number {
    return OhmLabService.WEIGHTS.reduce((sum, { ohms }, index) => sum + ohms * (this.digits[index] ?? 0), 0);
  }

  /**
   * Id del control de una perilla de la década.
   *
   * @param index Perilla (0 = ×1k … 3 = ×1).
   * @returns Id del control.
   */
  public static knobId(index: number): string {
    return `${OhmLabService.KNOB}${String(index)}`;
  }

  /**
   * Texto del tooltip de un control, o `null` si no es un control del circuito.
   *
   * @param id Control.
   * @returns Texto o `null`.
   */
  public describe(id: string): string | null {
    const knob = OhmLabService.knobOf(id);
    const weight = OhmLabService.WEIGHTS[knob];
    if (weight) {
      return this.text.knob(weight.label, this.digits[knob] ?? 0, this.state);
    }
    return this.tooltips[id]?.() ?? null;
  }

  /**
   * Usa un control con un clic: una perilla avanza un paso (del 9 vuelve al 0), el interruptor abre o
   * cierra el circuito y el LED o el cajón ponen un LED nuevo si el anterior se quemó.
   *
   * @param id Control.
   */
  public press(id: string): void {
    const knob = OhmLabService.knobOf(id);
    if (knob >= 0) {
      this.set(knob, ((this.digits[knob] ?? 0) + 1) % OhmLabService.STEPS);
    } else if (id === OhmLabService.SWITCH) {
      this.toggle();
    } else if (id === OhmLabService.LED || id === OhmLabService.SPARES) {
      this.replace();
    }
  }

  /**
   * Toma una perilla para girarla por pasos (0–9, con topes).
   *
   * @param id Control.
   * @returns Función que recibe los píxeles arrastrados hacia arriba, o `null` si no es una perilla.
   */
  public grab(id: string): ((pixels: number) => void) | null {
    const knob = OhmLabService.knobOf(id);
    if (knob < 0) {
      return null;
    }
    const start = this.digits[knob] ?? 0;
    const top = OhmLabService.STEPS - 1;
    return (pixels: number): void => {
      const steps = Math.round(pixels / OhmLabService.STEP_PIXELS);
      this.set(knob, Math.min(Math.max(start + steps, 0), top));
    };
  }

  /**
   * Avanza el calentamiento del LED: con sobrecorriente se quema al cabo de un instante.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    if (this.current(this.ohms) <= OhmLabService.LED_RATING.limit) {
      this.cool();
      return;
    }
    this.stress = Math.min(this.stress + delta / OhmLabService.LED_RATING.burnSeconds, 1);
    if (this.stress >= 1) {
      this.burn();
    }
    this.emit({ type: 'state' });
  }

  /**
   * Suscribe un oyente a los avisos del circuito.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: OhmLabEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Corriente del circuito: cero si está abierto o el LED quemado; con 0 Ω solo la limita la resistencia
   * interna de la batería.
   *
   * @param ohms Resistencia de la década.
   * @returns Amperios.
   */
  private current(ohms: number): number {
    if (!this.closed || this.burnt) {
      return 0;
    }
    const { volts, forward, internal } = OhmLabService.CIRCUIT;
    return (volts - forward) / (ohms > 0 ? ohms : internal);
  }

  /**
   * Magnitudes eléctricas del circuito para una resistencia.
   *
   * @param ohms Resistencia de la década.
   * @returns Voltajes, corriente, potencia y límites.
   */
  private electrical(
    ohms: number,
  ): Pick<OhmLabState, 'ohms' | 'volts' | 'forward' | 'amps' | 'limit' | 'watts' | 'rating' | 'brightness'> {
    const { volts, forward, rating } = OhmLabService.CIRCUIT;
    const { limit, nominal } = OhmLabService.LED_RATING;
    const amps = this.current(ohms);
    return {
      ohms,
      volts,
      forward,
      amps,
      limit,
      watts: amps * amps * ohms,
      rating,
      brightness: amps / nominal,
    };
  }

  /**
   * Enfría el LED al volver a una corriente segura.
   */
  private cool(): void {
    if (this.stress > 0) {
      this.stress = 0;
      this.emit({ type: 'state' });
    }
  }

  /**
   * Mueve una perilla a una posición (avisa la detención si cambió).
   *
   * @param knob Perilla.
   * @param digit Posición 0–9.
   */
  private set(knob: number, digit: number): void {
    if (this.digits[knob] === digit) {
      return;
    }
    this.digits[knob] = digit;
    this.emit({ type: 'detent' });
    this.emit({ type: 'state' });
  }

  /**
   * Abre o cierra el interruptor de la batería.
   */
  private toggle(): void {
    this.closed = !this.closed;
    this.stress = 0;
    this.emit({ type: 'switch', on: this.closed });
    this.emit({ type: 'state' });
  }

  /**
   * Quema el LED: el circuito queda abierto.
   */
  private burn(): void {
    this.burnt = true;
    this.stress = 0;
    this.casualties += 1;
    this.emit({ type: 'burn' });
  }

  /**
   * Pone un LED nuevo si el anterior está quemado.
   */
  private replace(): void {
    if (!this.burnt) {
      return;
    }
    this.burnt = false;
    this.stress = 0;
    this.emit({ type: 'replace' });
    this.emit({ type: 'state' });
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: OhmLabEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Perilla de un control `knob-<índice>`.
   *
   * @param id Control.
   * @returns Índice, o -1 si no es una perilla.
   */
  private static knobOf(id: string): number {
    return id.startsWith(OhmLabService.KNOB) ? Number(id.slice(OhmLabService.KNOB.length)) : -1;
  }
}
