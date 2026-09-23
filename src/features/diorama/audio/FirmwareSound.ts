import type { AudioEngine } from '@shared/audio/AudioEngine';

/**
 * Sonidos del laboratorio de firmware, sintetizados con Web Audio y a bajo volumen: el buzzer piezoeléctrico
 * (onda cuadrada, como la que saca `tone()`), el clic del botón de reinicio y un aviso de dos notas al
 * terminar una subida. Si el navegador todavía no deja sonar, no hace nada.
 */
export class FirmwareSound {
  private static readonly BUZZER = { gain: 0.012, attack: 0.004, release: 0.012, max: 0.4 };
  private static readonly CLICK = { hz: 2400, seconds: 0.012, gain: 0.02 };
  private static readonly CHIME = { notes: [{ hz: 1047 }, { hz: 1568 }], step: 0.09, seconds: 0.08 };
  private static readonly MILLIS = 1000;
  private static readonly SILENCE = 0.0001;

  /**
   * Crea los sonidos.
   *
   * @param engine Motor de audio compartido.
   */
  public constructor(private readonly engine: AudioEngine) {}

  /**
   * Pitido del buzzer.
   *
   * @param hz Frecuencia.
   * @param milliseconds Duración.
   */
  public tone(hz: number, milliseconds: number): void {
    const seconds = Math.min(milliseconds / FirmwareSound.MILLIS, FirmwareSound.BUZZER.max);
    this.play(hz, 0, seconds, FirmwareSound.BUZZER.gain);
  }

  /**
   * Clic del botón de reinicio.
   */
  public click(): void {
    const { hz, seconds, gain } = FirmwareSound.CLICK;
    this.play(hz, 0, seconds, gain);
  }

  /**
   * Aviso de subida terminada.
   */
  public chime(): void {
    const { notes, step, seconds } = FirmwareSound.CHIME;
    notes.forEach(({ hz }, index) => {
      this.play(hz, index * step, seconds, FirmwareSound.BUZZER.gain);
    });
  }

  /**
   * Toca una nota de onda cuadrada con una envolvente corta.
   *
   * @param hz Frecuencia.
   * @param delay Segundos hasta que empieza.
   * @param seconds Duración.
   * @param gain Volumen.
   */
  private play(hz: number, delay: number, seconds: number, gain: number): void {
    const { audioContext: context, output } = this.engine;
    if (!context || !output || context.state !== 'running') {
      return;
    }
    const { attack, release } = FirmwareSound.BUZZER;
    const start = context.currentTime + delay;
    const oscillator = new OscillatorNode(context, { type: 'square', frequency: hz });
    const envelope = new GainNode(context, { gain: 0 });
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + attack);
    envelope.gain.setValueAtTime(gain, start + seconds);
    envelope.gain.exponentialRampToValueAtTime(FirmwareSound.SILENCE, start + seconds + release);
    oscillator.connect(envelope).connect(output);
    oscillator.start(start);
    oscillator.stop(start + seconds + release);
  }
}
