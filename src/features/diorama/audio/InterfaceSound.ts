/**
 * Sonidos de interfaz: un "blip" suave al señalar un marcador y un acorde corto al seleccionarlo.
 */
export class InterfaceSound {
  private static readonly HOVER = { from: 1320, to: 1760, gain: 0.035, duration: 0.09 };
  private static readonly SELECT = [
    { frequency: 880, delay: 0, gain: 0.05 },
    { frequency: 1320, delay: 0.07, gain: 0.045 },
    { frequency: 1760, delay: 0.14, gain: 0.03 },
  ];
  private static readonly SELECT_DURATION = 0.22;
  private static readonly SILENCE = 0.0001;

  /**
   * Crea los sonidos de interfaz.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   */
  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  /**
   * Blip ascendente al pasar sobre un marcador.
   */
  public hover(): void {
    const { from, to, gain, duration } = InterfaceSound.HOVER;
    const start = this.context.currentTime;
    const oscillator = this.tone(from, start, gain, duration);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  }

  /**
   * Arpegio corto al seleccionar un marcador.
   */
  public select(): void {
    const start = this.context.currentTime;
    InterfaceSound.SELECT.forEach(({ frequency, delay, gain }) => {
      this.tone(frequency, start + delay, gain, InterfaceSound.SELECT_DURATION);
    });
  }

  /**
   * Tono triangular con caída exponencial.
   *
   * @param frequency Frecuencia inicial en Hz.
   * @param start Instante de inicio.
   * @param gain Volumen inicial.
   * @param duration Duración.
   * @returns Oscilador programado.
   */
  private tone(frequency: number, start: number, gain: number, duration: number): OscillatorNode {
    const oscillator = new OscillatorNode(this.context, { type: 'triangle', frequency });
    const envelope = new GainNode(this.context, { gain });
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(InterfaceSound.SILENCE, start + duration);
    oscillator.connect(envelope).connect(this.output);
    oscillator.start(start);
    oscillator.stop(start + duration);
    return oscillator;
  }
}
