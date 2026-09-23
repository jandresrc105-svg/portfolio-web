import type { AudioEngine } from '@shared/audio/AudioEngine';
import { NoiseBuffer } from '@shared/audio/NoiseBuffer';

/**
 * "Clack" metálico de una herramienta al salir de su gancho o volver a él: un golpe de ruido filtrado, dos
 * parciales inarmónicos que resuenan como acero y un golpe grave contra el tablero. Se sintetiza con Web
 * Audio y calla mientras el navegador no permita sonar.
 */
export class ToolWallSound {
  private static readonly HIT = { frequency: 3400, q: 2.2, gain: 0.28, duration: 0.05 };
  private static readonly RING = [
    { frequency: 1870, gain: 0.05, duration: 0.18 },
    { frequency: 3010, gain: 0.035, duration: 0.12 },
  ];
  private static readonly THUD = { frequency: 150, gain: 0.16, duration: 0.07 };
  private static readonly PITCH = { take: 1.08, hang: 0.9, variation: 0.06 };
  private static readonly SILENCE = 0.0001;

  private noise: { context: AudioContext; buffer: AudioBuffer } | null = null;

  /**
   * Crea el sonido.
   *
   * @param audio Motor de audio compartido.
   */
  public constructor(private readonly audio: AudioEngine) {}

  /**
   * Suena el clack.
   *
   * @param taking `true` al descolgar (más agudo), `false` al colgar.
   */
  public clack(taking: boolean): void {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return;
    }
    const { take, hang, variation } = ToolWallSound.PITCH;
    const pitch = (taking ? take : hang) * (1 + (Math.random() - 0.5) * variation);
    const start = context.currentTime;
    this.hit(context, output, start, pitch);
    ToolWallSound.RING.forEach((partial) => {
      ToolWallSound.tone(context, { output, start, pitch }, partial);
    });
    ToolWallSound.tone(context, { output, start, pitch: 1 }, ToolWallSound.THUD);
  }

  /**
   * Golpe: ruido blanco por un pasabanda agudo.
   *
   * @param context Contexto de audio.
   * @param output Salida.
   * @param start Instante de inicio.
   * @param pitch Factor de tono.
   */
  private hit(context: AudioContext, output: AudioNode, start: number, pitch: number): void {
    const { frequency, q, gain, duration } = ToolWallSound.HIT;
    const source = new AudioBufferSourceNode(context, { buffer: this.buffer(context) });
    source
      .connect(new BiquadFilterNode(context, { type: 'bandpass', frequency: frequency * pitch, Q: q }))
      .connect(ToolWallSound.envelope(context, output, { start, gain, duration }));
    source.start(start);
    source.stop(start + duration);
  }

  /**
   * Ruido blanco del golpe (se crea una vez por contexto).
   *
   * @param context Contexto de audio.
   * @returns Búfer de ruido.
   */
  private buffer(context: AudioContext): AudioBuffer {
    if (this.noise?.context !== context) {
      this.noise = { context, buffer: new NoiseBuffer(context).white(ToolWallSound.HIT.duration * 2) };
    }
    return this.noise.buffer;
  }

  /**
   * Tono senoidal con caída exponencial.
   *
   * @param context Contexto de audio.
   * @param route Salida, instante de inicio y factor de tono.
   * @param route.output Salida.
   * @param route.start Instante de inicio.
   * @param route.pitch Factor de tono.
   * @param tone Frecuencia, volumen y duración.
   * @param tone.frequency Frecuencia en Hz.
   * @param tone.gain Volumen inicial.
   * @param tone.duration Duración de la caída.
   */
  private static tone(
    context: AudioContext,
    route: { output: AudioNode; start: number; pitch: number },
    tone: { frequency: number; gain: number; duration: number },
  ): void {
    const { output, start, pitch } = route;
    const oscillator = new OscillatorNode(context, { frequency: tone.frequency * pitch });
    oscillator.connect(
      ToolWallSound.envelope(context, output, { start, gain: tone.gain, duration: tone.duration }),
    );
    oscillator.start(start);
    oscillator.stop(start + tone.duration);
  }

  /**
   * Envolvente de caída exponencial conectada a la salida.
   *
   * @param context Contexto de audio.
   * @param output Salida.
   * @param shape Inicio, volumen y duración.
   * @param shape.start Instante de inicio.
   * @param shape.gain Volumen inicial.
   * @param shape.duration Duración de la caída.
   * @returns Nodo de ganancia.
   */
  private static envelope(
    context: AudioContext,
    output: AudioNode,
    shape: { start: number; gain: number; duration: number },
  ): GainNode {
    const envelope = new GainNode(context, { gain: shape.gain });
    envelope.gain.exponentialRampToValueAtTime(ToolWallSound.SILENCE, shape.start + shape.duration);
    envelope.connect(output);
    return envelope;
  }
}
