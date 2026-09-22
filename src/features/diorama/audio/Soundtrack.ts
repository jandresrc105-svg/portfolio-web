import type { SoundtrackTrack } from '../models/SoundtrackTrack';

/**
 * Música de fondo del puesto: lista de pistas lofi que se reproducen en bucle, una tras otra.
 * Se transmiten con un elemento `<audio>` (no se descargan completas antes de sonar) y pasan
 * por un filtro suave, como si salieran de la radio del local.
 */
export class Soundtrack {
  private static readonly RADIO_LOWPASS = 6500;
  private static readonly FADE_IN_SECONDS = 5;
  private static readonly FADE_STEPS = 3;

  private readonly element = new Audio();
  private readonly trackGain: GainNode;
  private index = 0;
  private started = false;

  /**
   * Conecta el reproductor al grafo de audio.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   * @param tracks Pistas en orden de reproducción.
   * @param volume Volumen general de la música.
   */
  public constructor(
    private readonly context: AudioContext,
    output: AudioNode,
    private readonly tracks: readonly SoundtrackTrack[],
    private readonly volume: number,
  ) {
    this.element.preload = 'none';
    this.trackGain = new GainNode(context, { gain: 0 });
    context
      .createMediaElementSource(this.element)
      .connect(new BiquadFilterNode(context, { type: 'lowpass', frequency: Soundtrack.RADIO_LOWPASS }))
      .connect(this.trackGain)
      .connect(output);
    this.element.addEventListener('ended', this.next);
  }

  /**
   * Empieza a reproducir la primera pista con una entrada gradual. Llamarlo de nuevo no tiene efecto.
   */
  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.play(this.index, Soundtrack.FADE_IN_SECONDS);
  }

  /**
   * Pasa a la siguiente pista al terminar la actual.
   */
  private readonly next = (): void => {
    this.index = (this.index + 1) % this.tracks.length;
    this.play(this.index, 0);
  };

  /**
   * Carga y reproduce una pista con su ganancia.
   *
   * @param index Índice de la pista.
   * @param fadeSeconds Duración de la entrada gradual (0 = inmediata).
   */
  private play(index: number, fadeSeconds: number): void {
    const track = this.tracks[index];
    if (!track) {
      return;
    }
    const target = track.gain * this.volume;
    const now = this.context.currentTime;
    this.trackGain.gain.cancelScheduledValues(now);
    this.trackGain.gain.setTargetAtTime(target, now, Math.max(fadeSeconds, 1) / Soundtrack.FADE_STEPS);
    this.element.src = track.src;
    this.element.play().catch((error: unknown) => {
      console.warn('No fue posible reproducir la música', error);
    });
  }
}
