/**
 * Sonido ambiental en bucle sin cortes (la lluvia). Se descarga y decodifica completo para repetirlo
 * sin el pequeño silencio que dejan los elementos `<audio>` al volver al inicio.
 */
export class AmbientLoop {
  private static readonly FADE_IN_SECONDS = 4;
  private static readonly FADE_STEPS = 3;

  private started = false;

  /**
   * Crea el bucle.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   * @param src Ruta del archivo.
   * @param volume Volumen final.
   */
  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
    private readonly src: string,
    private readonly volume: number,
  ) {}

  /**
   * Descarga, decodifica y arranca el bucle con una entrada gradual. Llamarlo de nuevo no tiene efecto.
   *
   * @returns Promesa que se resuelve cuando empieza a sonar.
   */
  public async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    const response = await fetch(this.src);
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    const level = new GainNode(this.context, { gain: 0 });
    const now = this.context.currentTime;
    level.gain.setTargetAtTime(this.volume, now, AmbientLoop.FADE_IN_SECONDS / AmbientLoop.FADE_STEPS);
    const source = new AudioBufferSourceNode(this.context, { buffer, loop: true });
    source.connect(level).connect(this.output);
    source.start();
  }
}
