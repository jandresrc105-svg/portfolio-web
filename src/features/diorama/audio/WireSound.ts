import type { AudioEngine } from '@shared/audio/AudioEngine';

/**
 * Sonidos de la estación de cableado, sintetizados con Web Audio: el cable que sale del carrete, el clic del
 * corte, el "pop" del aislante al salir, el chisporroteo del estaño, el trinquete del tornillo de la bornera y
 * un aviso de dos tonos al cerrar el circuito. Si el navegador aún no deja sonar, calla.
 */
export class WireSound {
  private static readonly SNIP = { hz: 3200, q: 1.2, gain: 0.09, duration: 0.035, ping: 2400 };
  private static readonly RUSTLE = { hz: 900, q: 0.7, gain: 0.018 };
  private static readonly POP = { from: 620, to: 180, gain: 0.05, duration: 0.09 };
  private static readonly SIZZLE = { hz: 4600, q: 0.8, gain: 0.035, crackle: 0.03, floor: 0.25 };
  private static readonly RATCHET = { hz: 2600, q: 2, gain: 0.05, duration: 0.018, clicks: 7 };
  private static readonly CHIME = {
    tones: [{ hz: 880 }, { hz: 1320 }],
    gap: 0.12,
    gain: 0.03,
    duration: 0.25,
  };
  private static readonly BUZZ = { hz: 110, gain: 0.03, duration: 0.3 };
  private static readonly HARMONICS = 6;
  private static readonly NOISE_SECONDS = 1;
  private static readonly SILENCE = 0.0001;

  private noise: AudioBuffer | null = null;

  /**
   * Crea los sonidos.
   *
   * @param audio Motor de audio compartido.
   */
  public constructor(private readonly audio: AudioEngine) {}

  /**
   * Roce del cable que sale del carrete.
   *
   * @param duration Duración en segundos.
   */
  public rustle(duration: number): void {
    const { hz, q, gain } = WireSound.RUSTLE;
    this.burst({ at: 0, duration, gain }, { type: 'bandpass', frequency: hz, Q: q });
  }

  /**
   * Clic seco del alicate al cortar.
   */
  public snip(): void {
    const { hz, q, gain, duration, ping } = WireSound.SNIP;
    this.burst({ at: 0, duration, gain }, { type: 'highpass', frequency: hz, Q: q });
    this.tone({ hz: ping, at: 0, duration, gain: gain / 2 }, 'triangle');
  }

  /**
   * "Pop" del aislante al salir de la punta.
   */
  public pop(): void {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return;
    }
    const { from, to, gain, duration } = WireSound.POP;
    const now = context.currentTime;
    const oscillator = new OscillatorNode(context, { type: 'sine', frequency: from });
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    const envelope = new GainNode(context, { gain });
    envelope.gain.exponentialRampToValueAtTime(WireSound.SILENCE, now + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  /**
   * Chisporroteo del estaño y el fundente sobre el cobre caliente.
   *
   * @param delay Segundos hasta que la punta toca el cobre.
   * @param duration Duración del contacto.
   */
  public sizzle(delay: number, duration: number): void {
    const { hz, q, gain } = WireSound.SIZZLE;
    const envelope = this.burst({ at: delay, duration, gain }, { type: 'bandpass', frequency: hz, Q: q });
    if (envelope) {
      this.crackle(envelope, delay, duration);
    }
  }

  /**
   * Trinquete del destornillador apretando el tornillo de la bornera.
   *
   * @param delay Segundos hasta que empieza a girar.
   * @param duration Tiempo que dura el apriete.
   */
  public ratchet(delay: number, duration: number): void {
    const { hz, q, gain, duration: click, clicks } = WireSound.RATCHET;
    for (let index = 0; index < clicks; index++) {
      const at = delay + (index * duration) / clicks;
      this.burst({ at, duration: click, gain }, { type: 'bandpass', frequency: hz, Q: q });
    }
  }

  /**
   * Aviso de dos tonos: continuidad OK.
   */
  public chime(): void {
    const { tones, gap, gain, duration } = WireSound.CHIME;
    tones.forEach(({ hz }, index) => {
      this.tone({ hz, at: index * gap, duration, gain }, 'sine');
    });
  }

  /**
   * Zumbido grave de error: se cortaron hilos.
   */
  public buzz(): void {
    const { hz, gain, duration } = WireSound.BUZZ;
    this.tone({ hz, at: 0, duration, gain }, 'square');
  }

  /**
   * Ruido blanco filtrado con una envolvente que cae al final.
   *
   * @param shape Inicio (segundos desde ahora), duración y volumen.
   * @param shape.at Inicio.
   * @param shape.duration Duración.
   * @param shape.gain Volumen.
   * @param filter Filtro del ruido.
   * @returns Envolvente del ruido, o `null` si aún no se puede sonar.
   */
  private burst(
    shape: { at: number; duration: number; gain: number },
    filter: BiquadFilterOptions,
  ): GainNode | null {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return null;
    }
    const start = context.currentTime + shape.at;
    const source = new AudioBufferSourceNode(context, { buffer: this.buffer(context), loop: true });
    const envelope = WireSound.decay(context, shape.gain, start, start + shape.duration);
    source.connect(new BiquadFilterNode(context, filter)).connect(envelope).connect(output);
    source.start(start);
    source.stop(start + shape.duration);
    return envelope;
  }

  /**
   * Tono corto con caída exponencial.
   *
   * @param shape Frecuencia, inicio (segundos desde ahora), duración y volumen.
   * @param shape.hz Frecuencia.
   * @param shape.at Inicio.
   * @param shape.duration Duración.
   * @param shape.gain Volumen.
   * @param type Forma de onda.
   */
  private tone(
    shape: { hz: number; at: number; duration: number; gain: number },
    type: OscillatorType,
  ): void {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return;
    }
    const start = context.currentTime + shape.at;
    const oscillator = new OscillatorNode(context, { type, frequency: shape.hz });
    const envelope = WireSound.decay(context, shape.gain, start, start + shape.duration);
    const cutoff = WireSound.HARMONICS * shape.hz;
    oscillator
      .connect(new BiquadFilterNode(context, { type: 'lowpass', frequency: cutoff }))
      .connect(envelope)
      .connect(output);
    oscillator.start(start);
    oscillator.stop(start + shape.duration);
  }

  /**
   * Chasquidos al azar sobre la envolvente del chisporroteo.
   *
   * @param envelope Envolvente del ruido.
   * @param delay Inicio en segundos desde ahora.
   * @param duration Duración.
   */
  private crackle(envelope: GainNode, delay: number, duration: number): void {
    const { gain, crackle, floor } = WireSound.SIZZLE;
    const start = (this.audio.audioContext?.currentTime ?? 0) + delay;
    envelope.gain.cancelScheduledValues(start);
    for (let at = 0; at < duration; at += crackle) {
      const fade = 1 - at / duration;
      envelope.gain.setValueAtTime(gain * fade * (floor + Math.random()), start + at);
    }
    envelope.gain.linearRampToValueAtTime(0, start + duration);
  }

  /**
   * Búfer de ruido blanco (uno por contexto de audio).
   *
   * @param context Contexto de audio.
   * @returns Búfer.
   */
  private buffer(context: AudioContext): AudioBuffer {
    if (this.noise?.sampleRate !== context.sampleRate) {
      const length = context.sampleRate * WireSound.NOISE_SECONDS;
      this.noise = new AudioBuffer({ length, sampleRate: context.sampleRate });
      const data = this.noise.getChannelData(0);
      for (let index = 0; index < length; index++) {
        data[index] = Math.random() * 2 - 1;
      }
    }
    return this.noise;
  }

  /**
   * Envolvente que arranca con un volumen y cae hasta el silencio.
   *
   * @param context Contexto de audio.
   * @param gain Volumen inicial.
   * @param start Instante de inicio.
   * @param end Instante en que queda en silencio.
   * @returns Nodo de ganancia.
   */
  private static decay(context: AudioContext, gain: number, start: number, end: number): GainNode {
    const envelope = new GainNode(context, { gain: 0 });
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(WireSound.SILENCE, end);
    return envelope;
  }
}
