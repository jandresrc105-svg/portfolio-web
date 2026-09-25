import { NoiseBuffer } from '@shared/audio/NoiseBuffer';

/**
 * Trueno sintetizado: un chasquido inicial (si el rayo es cercano) y un retumbo grave largo.
 */
export class ThunderSound {
  private static readonly RUMBLE = { seconds: 7, baseFrequency: 90, extraFrequency: 200, gain: 0.5 };
  private static readonly ENVELOPE = { attack: 0.08, decay: 1.4 };
  private static readonly CRACK = { seconds: 0.5, frequency: 1600, gain: 0.18, threshold: 0.75 };
  private static readonly TIME_CONSTANT_STEPS = 3;

  private readonly rumble: AudioBuffer;
  private readonly crack: AudioBuffer;

  /**
   * Crea el trueno y prepara sus buffers de ruido.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   */
  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {
    this.rumble = new NoiseBuffer(context).brown(ThunderSound.RUMBLE.seconds);
    this.crack = new NoiseBuffer(context).white(ThunderSound.CRACK.seconds);
  }

  /**
   * Reproduce un trueno.
   *
   * @param strength Intensidad [0, 1]: los rayos cercanos suenan más fuerte y más agudos.
   * @param delay Segundos hasta que llega el sonido (la luz llega antes que el trueno).
   */
  public play(strength: number, delay: number): void {
    const start = this.context.currentTime + delay;
    this.playRumble(start, strength);
    if (strength > ThunderSound.CRACK.threshold) {
      this.playCrack(start, strength);
    }
  }

  /**
   * Retumbo grave con subida rápida y caída larga.
   *
   * @param start Instante de inicio.
   * @param strength Intensidad.
   */
  private playRumble(start: number, strength: number): void {
    const { baseFrequency, extraFrequency, gain, seconds } = ThunderSound.RUMBLE;
    const { attack, decay } = ThunderSound.ENVELOPE;
    const frequency = baseFrequency + extraFrequency * strength;
    const envelope = new GainNode(this.context, { gain: 0 });
    envelope.gain.setTargetAtTime(gain * strength, start, attack / ThunderSound.TIME_CONSTANT_STEPS);
    envelope.gain.setTargetAtTime(0, start + attack, decay);
    this.source(this.rumble, start, seconds)
      .connect(new BiquadFilterNode(this.context, { type: 'lowpass', frequency }))
      .connect(envelope)
      .connect(this.output);
  }

  /**
   * Chasquido seco del rayo cercano.
   *
   * @param start Instante de inicio.
   * @param strength Intensidad.
   */
  private playCrack(start: number, strength: number): void {
    const { seconds, frequency, gain } = ThunderSound.CRACK;
    const envelope = new GainNode(this.context, { gain: gain * strength });
    envelope.gain.setTargetAtTime(0, start, seconds / ThunderSound.TIME_CONSTANT_STEPS);
    this.source(this.crack, start, seconds)
      .connect(new BiquadFilterNode(this.context, { type: 'lowpass', frequency }))
      .connect(envelope)
      .connect(this.output);
  }

  /**
   * Fuente de un solo uso programada en el tiempo.
   *
   * @param buffer Buffer de ruido.
   * @param start Instante de inicio.
   * @param seconds Duración.
   * @returns Fuente programada.
   */
  private source(buffer: AudioBuffer, start: number, seconds: number): AudioBufferSourceNode {
    const source = new AudioBufferSourceNode(this.context, { buffer });
    source.start(start);
    source.stop(start + seconds);
    return source;
  }
}
