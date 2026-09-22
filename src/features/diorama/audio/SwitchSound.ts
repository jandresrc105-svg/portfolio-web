import { NoiseBuffer } from '@shared/audio/NoiseBuffer';

/**
 * Chasquido de relé/arrancador: un clic metálico corto más un golpe grave.
 * Suena en cada destello de los tubos durante la secuencia de encendido.
 */
export class SwitchSound {
  private static readonly CLICK = { frequency: 2600, q: 1.4, gain: 0.45, duration: 0.035 };
  private static readonly THUMP = { frequency: 92, gain: 0.3, duration: 0.11 };
  private static readonly PITCH_VARIATION = 0.15;
  private static readonly SILENCE = 0.0001;

  private readonly noise: AudioBuffer;

  /**
   * Crea el sonido.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   */
  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {
    this.noise = new NoiseBuffer(context).white(SwitchSound.CLICK.duration * 2);
  }

  /**
   * Reproduce un chasquido con una leve variación de tono para que no suene repetitivo.
   */
  public play(): void {
    const start = this.context.currentTime;
    const pitch = 1 + (Math.random() - 0.5) * SwitchSound.PITCH_VARIATION;
    this.click(start, pitch);
    this.thump(start, pitch);
  }

  /**
   * Clic metálico: ruido filtrado con caída muy rápida.
   *
   * @param start Instante de inicio.
   * @param pitch Factor de tono.
   */
  private click(start: number, pitch: number): void {
    const { frequency, q, gain, duration } = SwitchSound.CLICK;
    const source = new AudioBufferSourceNode(this.context, { buffer: this.noise });
    const envelope = this.envelope(start, gain, duration);
    source
      .connect(new BiquadFilterNode(this.context, { type: 'bandpass', frequency: frequency * pitch, Q: q }))
      .connect(envelope);
    source.start(start);
    source.stop(start + duration);
  }

  /**
   * Golpe grave del contacto al cerrar.
   *
   * @param start Instante de inicio.
   * @param pitch Factor de tono.
   */
  private thump(start: number, pitch: number): void {
    const { frequency, gain, duration } = SwitchSound.THUMP;
    const oscillator = new OscillatorNode(this.context, { frequency: frequency * pitch });
    oscillator.connect(this.envelope(start, gain, duration));
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  /**
   * Envolvente de caída exponencial conectada a la salida.
   *
   * @param start Instante de inicio.
   * @param peak Volumen inicial.
   * @param duration Duración de la caída.
   * @returns Nodo de ganancia con la envolvente programada.
   */
  private envelope(start: number, peak: number, duration: number): GainNode {
    const envelope = new GainNode(this.context, { gain: peak });
    envelope.gain.exponentialRampToValueAtTime(SwitchSound.SILENCE, start + duration);
    envelope.connect(this.output);
    return envelope;
  }
}
