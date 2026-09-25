import { NoiseBuffer } from '@shared/audio/NoiseBuffer';

/**
 * Zumbido de la bola de plasma, sintetizado: un diente de sierra grave filtrado (el transformador) y un
 * chisporroteo de ruido agudo (las descargas). Al tocar el vidrio el chisporroteo sube y el tono se tensa.
 */
export class PlasmaHum {
  private static readonly BODY = { hz: 110, touchHz: 128, cutoff: 480, q: 1.2, gain: 0.6 };
  private static readonly CRACKLE = { hz: 4200, q: 0.9, idle: 0.08, touched: 0.5, seconds: 2 };
  private static readonly VOLUME = { level: 0.028, attack: 0.4, release: 0.25, glide: 0.12 };

  private voice: {
    body: OscillatorNode;
    noise: AudioBufferSourceNode;
    crackle: GainNode;
    master: GainNode;
  } | null = null;
  private touched = false;

  /**
   * Crea el zumbido.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   */
  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  /**
   * Prende o apaga el zumbido con un fundido.
   *
   * @param on Si suena.
   */
  public setRunning(on: boolean): void {
    if (on && !this.voice) {
      this.start();
    } else if (!on && this.voice) {
      this.stop();
    }
  }

  /**
   * Avisa si el puntero está sobre el vidrio.
   *
   * @param touched Si está señalada.
   */
  public setTouched(touched: boolean): void {
    this.touched = touched;
    if (!this.voice) {
      return;
    }
    const now = this.context.currentTime;
    const { idle, touched: loud } = PlasmaHum.CRACKLE;
    const { hz, touchHz } = PlasmaHum.BODY;
    this.voice.crackle.gain.setTargetAtTime(touched ? loud : idle, now, PlasmaHum.VOLUME.glide);
    this.voice.body.frequency.setTargetAtTime(touched ? touchHz : hz, now, PlasmaHum.VOLUME.glide);
  }

  /**
   * Arma las fuentes y sube el volumen.
   */
  private start(): void {
    const now = this.context.currentTime;
    const { level, attack } = PlasmaHum.VOLUME;
    const master = new GainNode(this.context, { gain: 0 });
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(level, now + attack);
    master.connect(this.output);
    const body = this.body(master);
    const { noise, crackle } = this.crackle(master);
    body.start(now);
    noise.start(now);
    this.voice = { body, noise, crackle, master };
    this.setTouched(this.touched);
  }

  /**
   * Baja el volumen y detiene las fuentes.
   */
  private stop(): void {
    if (!this.voice) {
      return;
    }
    const { body, noise, master } = this.voice;
    const now = this.context.currentTime;
    const { release } = PlasmaHum.VOLUME;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + release);
    body.stop(now + release);
    noise.stop(now + release);
    this.voice = null;
  }

  /**
   * Diente de sierra grave pasado por un filtro pasabajos.
   *
   * @param master Nodo de volumen.
   * @returns Oscilador.
   */
  private body(master: GainNode): OscillatorNode {
    const { hz, cutoff, q, gain } = PlasmaHum.BODY;
    const oscillator = new OscillatorNode(this.context, { type: 'sawtooth', frequency: hz });
    oscillator
      .connect(new BiquadFilterNode(this.context, { type: 'lowpass', frequency: cutoff, Q: q }))
      .connect(new GainNode(this.context, { gain }))
      .connect(master);
    return oscillator;
  }

  /**
   * Ruido blanco en bucle por un pasabanda agudo.
   *
   * @param master Nodo de volumen.
   * @returns Fuente de ruido y su ganancia.
   */
  private crackle(master: GainNode): { noise: AudioBufferSourceNode; crackle: GainNode } {
    const { hz, q, idle, seconds } = PlasmaHum.CRACKLE;
    const noise = new AudioBufferSourceNode(this.context, {
      buffer: new NoiseBuffer(this.context).white(seconds),
      loop: true,
    });
    const crackle = new GainNode(this.context, { gain: idle });
    noise
      .connect(new BiquadFilterNode(this.context, { type: 'bandpass', frequency: hz, Q: q }))
      .connect(crackle)
      .connect(master);
    return { noise, crackle };
  }
}
