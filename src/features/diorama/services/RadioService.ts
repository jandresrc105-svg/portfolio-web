import { SeededRandom } from '@shared/core/math/SeededRandom';
import type { RadioAudio } from '../models/RadioAudio';
import type { RadioCarrier } from '../models/RadioCarrier';
import type { RadioEmission } from '../models/RadioEmission';
import type { RadioEvent } from '../models/RadioEvent';
import { RadioMode } from '../models/RadioMode';
import type { RadioReception } from '../models/RadioReception';
import type { RadioState } from '../models/RadioState';
import { MorseAlphabet } from './MorseAlphabet';
import { MorseDecoder } from './MorseDecoder';
import { MorseKeyer } from './MorseKeyer';
import { RadioSpectrum } from './RadioSpectrum';

/**
 * Receptor SDR de la banda de 40 m (estado + Observer, sin DOM). Simula la banda con cuatro emisoras fijas
 * (dos balizas CW que repiten su mensaje en morse y dos emisoras AM con una melodía), el filtro del
 * receptor (más angosto en CW), la ganancia de la antena según cuánto se extiende, el control automático de
 * frecuencia (AFC) que engancha la emisora cercana, la búsqueda (SCAN), el squelch y el decodificador de
 * morse que lee la baliza sintonizada con el ruido que deja pasar la antena. También entrega el espectro
 * para la pantalla y lo que debe sonar en el parlante.
 */
export class RadioService {
  public static readonly BAND = { from: 7000, to: 7300, name: '40 m' };
  public static readonly STATIONS: readonly RadioCarrier[] = [
    {
      frequency: 7030,
      mode: RadioMode.Cw,
      power: 1,
      label: 'Baliza JR',
      message: 'CQ CQ DE JUAN REYES K',
      notes: [],
    },
    {
      frequency: 7120,
      mode: RadioMode.Am,
      power: 0.8,
      label: 'Radio Taller',
      message: '',
      notes: [
        { hz: 523 },
        { hz: 659 },
        { hz: 784 },
        { hz: 659 },
        { hz: 587 },
        { hz: 698 },
        { hz: 880 },
        { hz: 698 },
      ],
    },
    {
      frequency: 7185,
      mode: RadioMode.Cw,
      power: 0.5,
      label: 'Baliza DSP',
      message: 'VVV DE JR DSP EN TYPESCRIPT',
      notes: [],
    },
    {
      frequency: 7262,
      mode: RadioMode.Am,
      power: 0.35,
      label: 'Onda lejana',
      message: '',
      notes: [{ hz: 392 }, { hz: 440 }, { hz: 494 }, { hz: 587 }, { hz: 494 }, { hz: 440 }],
    },
  ];

  private static readonly MORSE = { unit: 0.085, phase: 7.3 };
  private static readonly NOTE = { duration: 0.3, gate: 0.82, modulation: 0.5, rest: 0.12 };
  private static readonly WINDOW: Record<RadioMode, number> = { [RadioMode.Am]: 5, [RadioMode.Cw]: 2 };
  private static readonly ANTENNA = { min: 0.2, max: 1.15, gain: 0.12, initial: 0.6 };
  private static readonly AFC = { range: 3.5, rate: 5, lock: 0.08 };
  private static readonly SCAN = { speed: 90, skip: 1 };
  private static readonly BFO = { pitch: 700, perKhz: 300, min: 250 };
  private static readonly MISMATCH = 0.3;
  private static readonly RECEPTION = { decode: 0.35, keyed: 0.2, squelch: 0.08 };
  private static readonly DECODER = { noise: 0.16, threshold: 0.5 };
  private static readonly NOISE = { floor: 0.05, ducking: 0.85, min: 0.08 };
  private static readonly DECIBELS = { factor: 20, epsilon: 0.001 };
  private static readonly TANK = { inductance: 2.2e-6, hertz: 1000, picofarads: 1e12 };
  private static readonly SEED = 7040;

  private readonly listeners = new Set<(event: RadioEvent) => void>();
  private readonly alphabet = new MorseAlphabet();
  private readonly decoder = new MorseDecoder(this.alphabet);
  private readonly random = new SeededRandom(RadioService.SEED);
  private readonly spectrum = new RadioSpectrum(RadioService.BAND, this.random);
  private readonly keyers = new Map<RadioCarrier, MorseKeyer>();
  private powered = true;
  private active = false;
  private mode = RadioMode.Cw;
  private frequency = RadioService.STATIONS[0]?.frequency ?? RadioService.BAND.from;
  private antenna = RadioService.ANTENNA.initial;
  private squelch = false;
  private target: number | null = null;
  private tuned: RadioCarrier | null = null;
  private time = 0;

  /**
   * Crea el receptor y el manipulador de cada baliza.
   */
  public constructor() {
    const { unit, phase } = RadioService.MORSE;
    RadioService.STATIONS.forEach((station, index) => {
      if (station.mode === RadioMode.Cw) {
        this.keyers.set(station, new MorseKeyer(station.message, unit, this.alphabet, index * phase));
      }
    });
  }

  /**
   * Estado actual del receptor.
   *
   * @returns Estado.
   */
  public get state(): RadioState {
    return { ...this.settings(), ...this.signalState(), ...this.decoding() };
  }

  /**
   * Avisa si el taller está en pantalla: fuera de él el receptor calla y deja de buscar.
   *
   * @param active Si está en pantalla.
   */
  public setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.target = null;
    }
    this.emit({ type: 'state' });
  }

  /**
   * Enciende o apaga el receptor.
   */
  public togglePower(): void {
    this.powered = !this.powered;
    this.target = null;
    this.decoder.clear();
    this.emit({ type: 'state' });
  }

  /**
   * Cambia entre AM y CW.
   */
  public toggleMode(): void {
    this.mode = this.mode === RadioMode.Cw ? RadioMode.Am : RadioMode.Cw;
    this.decoder.clear();
    this.emit({ type: 'state' });
  }

  /**
   * Activa o quita el squelch.
   */
  public toggleSquelch(): void {
    this.squelch = !this.squelch;
    this.emit({ type: 'state' });
  }

  /**
   * Busca la siguiente emisora hacia arriba (al llegar al final vuelve a la primera).
   */
  public scan(): void {
    if (!this.powered) {
      return;
    }
    const stations = RadioService.STATIONS;
    const next = stations.find(({ frequency }) => frequency > this.frequency + RadioService.SCAN.skip);
    this.target = (next ?? stations[0])?.frequency ?? null;
    this.emit({ type: 'state' });
  }

  /**
   * Sintoniza una frecuencia (cancela la búsqueda).
   *
   * @param frequency Frecuencia en kHz (se limita a la banda).
   */
  public tune(frequency: number): void {
    const { from, to } = RadioService.BAND;
    this.target = null;
    this.frequency = Math.min(Math.max(frequency, from), to);
  }

  /**
   * Extiende o recoge la antena.
   *
   * @param extension 0 = recogida, 1 = extendida.
   */
  public extend(extension: number): void {
    this.antenna = Math.min(Math.max(extension, 0), 1);
  }

  /**
   * Avanza la simulación: balizas, búsqueda, AFC y decodificador.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    this.time += delta;
    if (!this.powered) {
      return;
    }
    this.follow(delta);
    this.listen(delta);
  }

  /**
   * Lo que debe sonar ahora en el parlante (silencio si está apagado o fuera de pantalla).
   *
   * @returns Niveles y tono.
   */
  public audio(): RadioAudio {
    if (!this.powered || !this.active) {
      return { noise: 0, tone: 0, pitch: RadioService.BFO.pitch, mode: this.mode };
    }
    const reception = this.reception();
    const { ducking, min } = RadioService.NOISE;
    const silent = this.squelch && reception.signal < RadioService.RECEPTION.squelch;
    const noise = silent ? 0 : Math.max(1 - reception.signal * ducking, min);
    return { noise, ...this.tone(reception), mode: this.mode };
  }

  /**
   * Llena el espectro de la banda (todo en 0 si está apagado).
   *
   * @param out Casillas de frecuencia, de la más baja a la más alta.
   */
  public sample(out: Float32Array): void {
    if (this.powered) {
      this.spectrum.compute(out, this.emissions());
    } else {
      out.fill(0);
    }
  }

  /**
   * Suscribe un oyente a los avisos del receptor.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: RadioEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Controles del equipo y valores derivados de ellos.
   *
   * @returns Parte del estado.
   */
  private settings(): Omit<
    RadioState,
    'snr' | 'station' | 'signal' | 'locked' | 'keyed' | 'decoding' | 'decoded' | 'pattern' | 'lastSymbol'
  > {
    const { from, to } = RadioService.BAND;
    const { min, max } = RadioService.ANTENNA;
    return {
      on: this.powered,
      mode: this.mode,
      frequency: this.frequency,
      dial: (this.frequency - from) / (to - from),
      window: RadioService.WINDOW[this.mode],
      antenna: this.antenna,
      antennaLength: min + (max - min) * this.antenna,
      squelch: this.squelch,
      scanning: this.target !== null,
      capacitance: this.capacitance(),
    };
  }

  /**
   * Emisora sintonizada y calidad de la señal.
   *
   * @returns Parte del estado.
   */
  private signalState(): Pick<RadioState, 'snr' | 'station' | 'signal' | 'locked' | 'keyed'> {
    const { station, response, signal } = this.reception();
    if (!this.powered || station === null) {
      return { station: null, signal: 0, snr: 0, locked: false, keyed: false };
    }
    const { factor, epsilon } = RadioService.DECIBELS;
    const snr = factor * Math.log10(Math.max(signal, epsilon) / RadioService.NOISE.floor);
    const centered = Math.abs(this.frequency - station.frequency) < RadioService.AFC.lock;
    const keyed =
      station.mode === RadioMode.Cw && response > RadioService.RECEPTION.keyed && this.keyed(station);
    return { station, signal, snr: Math.max(snr, 0), locked: centered && this.target === null, keyed };
  }

  /**
   * Estado del decodificador de morse.
   *
   * @returns Parte del estado.
   */
  private decoding(): Pick<RadioState, 'decoding' | 'decoded' | 'pattern' | 'lastSymbol'> {
    const { station, response } = this.reception();
    return {
      decoding: this.powered && this.decodable(station, response),
      decoded: this.decoder.decoded,
      pattern: this.decoder.pattern,
      lastSymbol: this.decoder.lastSymbol,
    };
  }

  /**
   * Capacidad del capacitor variable que hace resonar el tanque LC en la frecuencia sintonizada:
   * f = 1 / (2π√(LC)), o sea C = 1 / ((2πf)² L).
   *
   * @returns Capacidad en pF.
   */
  private capacitance(): number {
    const { inductance, hertz, picofarads } = RadioService.TANK;
    const omega = 2 * Math.PI * this.frequency * hertz;
    return picofarads / (omega * omega * inductance);
  }

  /**
   * Emisora más fuerte que deja pasar el filtro.
   *
   * @returns Recepción.
   */
  private reception(): RadioReception {
    let best: RadioReception = { station: null, response: 0, signal: 0 };
    RadioService.STATIONS.forEach((station) => {
      const response = this.response(station);
      const match = station.mode === this.mode ? 1 : RadioService.MISMATCH;
      const signal = station.power * this.gain() * response * match;
      if (signal > best.signal) {
        best = { station, response, signal };
      }
    });
    return best;
  }

  /**
   * Respuesta del filtro del receptor a una emisora (parábola dentro de la banda de paso).
   *
   * @param station Emisora.
   * @returns Entre 0 y 1.
   */
  private response(station: RadioCarrier): number {
    const ratio = (this.frequency - station.frequency) / RadioService.WINDOW[this.mode];
    return Math.max(1 - ratio * ratio, 0);
  }

  /**
   * Ganancia de la antena: una antena más larga (más cerca de λ/4) capta más señal.
   *
   * @returns Entre la ganancia mínima y 1.
   */
  private gain(): number {
    const { gain } = RadioService.ANTENNA;
    return gain + (1 - gain) * this.antenna;
  }

  /**
   * Búsqueda en curso o, si no hay, el AFC que engancha la emisora cercana.
   *
   * @param delta Segundos.
   */
  private follow(delta: number): void {
    if (this.target !== null) {
      this.glide(this.target, delta);
      return;
    }
    const { range, rate } = RadioService.AFC;
    const near = RadioService.STATIONS.find(({ frequency }) => Math.abs(frequency - this.frequency) < range);
    if (near) {
      this.frequency += (near.frequency - this.frequency) * Math.min(rate * delta, 1);
    }
  }

  /**
   * Avanza la búsqueda hacia la emisora siguiente.
   *
   * @param target Frecuencia buscada.
   * @param delta Segundos.
   */
  private glide(target: number, delta: number): void {
    const step = RadioService.SCAN.speed * delta;
    const distance = target - this.frequency;
    if (Math.abs(distance) <= step) {
      this.frequency = target;
      this.target = null;
      this.emit({ type: 'state' });
    } else {
      this.frequency += Math.sign(distance) * step;
    }
  }

  /**
   * Recibe la emisora sintonizada y, si es una baliza CW, decodifica su morse.
   *
   * @param delta Segundos.
   */
  private listen(delta: number): void {
    const { station, response, signal } = this.reception();
    if (station !== this.tuned) {
      this.tuned = station;
      this.decoder.clear();
      this.emit({ type: 'state' });
    }
    if (!this.decodable(station, response)) {
      this.decoder.reset();
      return;
    }
    const { noise, threshold } = RadioService.DECODER;
    const received = (this.keyed(station) ? signal : 0) + (this.random.next() - 1 / 2) * 2 * noise;
    const letter = this.decoder.feed(received > signal * threshold, delta);
    if (letter !== null) {
      this.emit({ type: 'letter', letter });
    }
  }

  /**
   * Indica si la emisora se puede decodificar: una baliza CW bien sintonizada, en modo CW.
   *
   * @param station Emisora o `null`.
   * @param response Respuesta del filtro.
   * @returns `true` si se decodifica.
   */
  private decodable(station: RadioCarrier | null, response: number): station is RadioCarrier {
    const cw = station?.mode === RadioMode.Cw && this.mode === RadioMode.Cw;
    return cw && response > RadioService.RECEPTION.decode;
  }

  /**
   * Indica si una baliza tiene la llave bajada ahora.
   *
   * @param station Emisora.
   * @returns `true` si transmite.
   */
  private keyed(station: RadioCarrier): boolean {
    return this.keyers.get(station)?.keyed(this.time) ?? false;
  }

  /**
   * Lo que cada emisora pone en el aire ahora, visto por la antena.
   *
   * @returns Emisiones.
   */
  private emissions(): RadioEmission[] {
    return RadioService.STATIONS.map((station) => {
      const am = station.mode === RadioMode.Am;
      const on = am || this.keyed(station);
      return {
        frequency: station.frequency,
        amplitude: on ? station.power * this.gain() : 0,
        modulation: am ? this.note(station).level * RadioService.NOTE.modulation : 0,
      };
    });
  }

  /**
   * Tono demodulado: en CW el BFO bate con la portadora (700 Hz centrado); en AM se oye la melodía.
   *
   * @param reception Recepción.
   * @returns Nivel y frecuencia del tono.
   */
  private tone(reception: RadioReception): { tone: number; pitch: number } {
    const { station, signal } = reception;
    const { pitch, perKhz, min } = RadioService.BFO;
    if (!station) {
      return { tone: 0, pitch };
    }
    if (this.mode === RadioMode.Cw) {
      const beat = Math.max(pitch + (this.frequency - station.frequency) * perKhz, min);
      const carrier = station.mode === RadioMode.Am || this.keyed(station);
      return { tone: carrier ? signal : 0, pitch: beat };
    }
    if (station.mode === RadioMode.Am) {
      const note = this.note(station);
      return { tone: signal * note.level, pitch: note.hz };
    }
    return { tone: 0, pitch };
  }

  /**
   * Nota que suena ahora en una emisora AM.
   *
   * @param station Emisora.
   * @returns Frecuencia y nivel (baja entre notas).
   */
  private note(station: RadioCarrier): { hz: number; level: number } {
    const { duration, gate, rest } = RadioService.NOTE;
    const steps = this.time / duration;
    const index = Math.floor(steps) % Math.max(station.notes.length, 1);
    return { hz: station.notes[index]?.hz ?? 0, level: steps % 1 < gate ? 1 : rest };
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: RadioEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
