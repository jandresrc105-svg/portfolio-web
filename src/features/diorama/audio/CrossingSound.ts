import type { AudioEngine } from '@shared/audio/AudioEngine';

/**
 * Aviso sonoro del cruce peatonal japonés ("piyo-piyo"): dos trinos cortos que bajan de tono, sintetizados con
 * el {@link AudioEngine}. Suena bajito: es ambiente de la esquina, no una alarma.
 */
export class CrossingSound {
  private static readonly TRILL = { from: 2900, to: 2250, duration: 0.07, gap: 0.14, gain: 0.012 };
  private static readonly NOTES = 2;
  private static readonly SILENCE = 0.0001;

  /**
   * Prepara el sonido.
   *
   * @param audio Motor de audio compartido.
   */
  public constructor(private readonly audio: AudioEngine) {}

  /**
   * Suena un "piyo-piyo".
   */
  public chirp(): void {
    for (let note = 0; note < CrossingSound.NOTES; note += 1) {
      this.trill(note * CrossingSound.TRILL.gap);
    }
  }

  /**
   * Un trino: un silbido que baja rápido de tono.
   *
   * @param delay Segundos de espera antes de sonar.
   */
  private trill(delay: number): void {
    const context = this.audio.audioContext;
    const output = this.audio.output;
    if (!context || !output) {
      return;
    }
    const { from, to, duration, gain } = CrossingSound.TRILL;
    const start = context.currentTime + delay;
    const oscillator = new OscillatorNode(context, { type: 'sine', frequency: from });
    oscillator.frequency.setValueAtTime(from, start);
    oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
    const envelope = new GainNode(context, { gain: 0 });
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(CrossingSound.SILENCE, start + duration);
    oscillator.connect(envelope).connect(output);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}
