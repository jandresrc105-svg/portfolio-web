import type { AudioEngine } from '@shared/audio/AudioEngine';
import { NoiseBuffer } from '@shared/audio/NoiseBuffer';

/**
 * Sonidos del circuito de la Ley de Ohm, sintetizados con Web Audio: la detención de las perillas de la
 * década, el interruptor de la batería, el "pop" del LED al quemarse (chasquido, golpe grave y chisporroteo)
 * y el clic del LED nuevo al entrar en la protoboard. No suena mientras el navegador no lo permita.
 */
export class OhmLabSound {
  private static readonly DETENT = { hz: 1900, gain: 0.018, duration: 0.012 };
  private static readonly SWITCH = [
    { hz: 1300, gain: 0.03, delay: 0, duration: 0.02 },
    { hz: 520, gain: 0.03, delay: 0.012, duration: 0.05 },
  ];
  private static readonly SEAT = [
    { hz: 2600, gain: 0.02, delay: 0, duration: 0.015 },
    { hz: 2200, gain: 0.02, delay: 0.07, duration: 0.015 },
  ];
  private static readonly POP = { hz: 1400, q: 0.9, gain: 0.5, duration: 0.18 };
  private static readonly THUMP = { hz: 110, drop: 45, gain: 0.35, duration: 0.16 };
  private static readonly SIZZLE = { hz: 4200, gain: 0.05, delay: 0.05, duration: 0.9 };
  private static readonly SILENCE = 0.0001;

  private noise: { context: AudioContext; buffer: AudioBuffer } | null = null;

  /**
   * Crea los sonidos.
   *
   * @param audio Motor de audio compartido.
   */
  public constructor(private readonly audio: AudioEngine) {}

  /**
   * Clic seco de una perilla al pasar por una detención.
   */
  public detent(): void {
    const { hz, gain, duration } = OhmLabSound.DETENT;
    this.blips([{ hz, gain, delay: 0, duration }], 'square');
  }

  /**
   * Chasquido del interruptor de la batería (más agudo al cerrar).
   *
   * @param on Si cerró el circuito.
   */
  public toggle(on: boolean): void {
    this.blips(on ? OhmLabSound.SWITCH : [...OhmLabSound.SWITCH].reverse(), 'triangle');
  }

  /**
   * Clic del LED nuevo al entrar en la protoboard.
   */
  public seat(): void {
    this.blips(OhmLabSound.SEAT, 'square');
  }

  /**
   * "Pop" del LED quemado: chasquido de ruido, golpe grave que cae y chisporroteo agudo.
   */
  public pop(): void {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return;
    }
    const start = context.currentTime;
    const { hz, q, gain, duration } = OhmLabSound.POP;
    this.burst(context, output, { type: 'bandpass', hz, q, gain, start, duration });
    const sizzle = OhmLabSound.SIZZLE;
    this.burst(context, output, {
      type: 'highpass',
      hz: sizzle.hz,
      q: 1,
      gain: sizzle.gain,
      start: start + sizzle.delay,
      duration: sizzle.duration,
    });
    this.thump(context, output, start);
  }

  /**
   * Tonos cortos con caída exponencial.
   *
   * @param tones Tono, volumen, retraso y duración de cada uno.
   * @param type Forma de onda.
   */
  private blips(
    tones: readonly { hz: number; gain: number; delay: number; duration: number }[],
    type: OscillatorType,
  ): void {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return;
    }
    const now = context.currentTime;
    tones.forEach(({ hz, gain, delay, duration }) => {
      const oscillator = new OscillatorNode(context, { type, frequency: hz });
      const envelope = new GainNode(context, { gain: 0 });
      envelope.gain.setValueAtTime(gain, now + delay);
      envelope.gain.exponentialRampToValueAtTime(OhmLabSound.SILENCE, now + delay + duration);
      oscillator.connect(envelope).connect(output);
      oscillator.start(now + delay);
      oscillator.stop(now + delay + duration);
    });
  }

  /**
   * Ráfaga de ruido filtrado con caída exponencial.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   * @param shape Filtro, volumen, inicio y duración.
   * @param shape.type Tipo de filtro.
   * @param shape.hz Frecuencia del filtro.
   * @param shape.q Resonancia.
   * @param shape.gain Volumen inicial.
   * @param shape.start Instante de inicio.
   * @param shape.duration Duración.
   */
  private burst(
    context: AudioContext,
    output: AudioNode,
    shape: { type: BiquadFilterType; hz: number; q: number; gain: number; start: number; duration: number },
  ): void {
    const source = new AudioBufferSourceNode(context, { buffer: this.buffer(context) });
    const filter = new BiquadFilterNode(context, { type: shape.type, frequency: shape.hz, Q: shape.q });
    const envelope = new GainNode(context, { gain: 0 });
    envelope.gain.setValueAtTime(shape.gain, shape.start);
    envelope.gain.exponentialRampToValueAtTime(OhmLabSound.SILENCE, shape.start + shape.duration);
    source.connect(filter).connect(envelope).connect(output);
    source.start(shape.start);
    source.stop(shape.start + shape.duration);
  }

  /**
   * Golpe grave cuyo tono cae.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   * @param start Instante de inicio.
   */
  private thump(context: AudioContext, output: AudioNode, start: number): void {
    const { hz, drop, gain, duration } = OhmLabSound.THUMP;
    const oscillator = new OscillatorNode(context, { type: 'sine', frequency: hz });
    oscillator.frequency.setValueAtTime(hz, start);
    oscillator.frequency.exponentialRampToValueAtTime(drop, start + duration);
    const envelope = new GainNode(context, { gain: 0 });
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(OhmLabSound.SILENCE, start + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  /**
   * Ruido blanco del contexto (se crea una vez por contexto).
   *
   * @param context Contexto de audio.
   * @returns Búfer de ruido.
   */
  private buffer(context: AudioContext): AudioBuffer {
    if (this.noise?.context !== context) {
      const seconds = Math.max(OhmLabSound.SIZZLE.duration, OhmLabSound.POP.duration);
      this.noise = { context, buffer: new NoiseBuffer(context).white(seconds) };
    }
    return this.noise.buffer;
  }
}
