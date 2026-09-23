import { PhoneLine } from '../models/PhoneLine';

/**
 * Sonidos del teléfono público, sintetizados: timbre de campanilla, tonos DTMF de las teclas y los tonos de
 * la línea japonesa (400 Hz): continuo para marcar, a intervalos para la llamada y en pulsos para ocupado.
 */
export class PhoneSound {
  private static readonly DTMF = {
    rows: [{ hz: 697 }, { hz: 770 }, { hz: 852 }, { hz: 941 }],
    columns: [{ hz: 1209 }, { hz: 1336 }, { hz: 1477 }],
    gain: 0.035,
    duration: 0.16,
  };
  private static readonly RING = {
    tones: [{ hz: 1250 }, { hz: 1560 }],
    pulse: 0.05,
    pulses: 16,
    bursts: 2,
    gap: 0.25,
    gain: 0.03,
  };
  private static readonly LINE = { hz: 400, gain: 0.03, span: 20, fade: 0.03 };
  private static readonly CADENCE: Record<PhoneLine, { on: number; off: number } | null> = {
    [PhoneLine.Silent]: null,
    [PhoneLine.DialTone]: { on: 20, off: 0 },
    [PhoneLine.Ringback]: { on: 1, off: 1.2 },
    [PhoneLine.Busy]: { on: 0.4, off: 0.4 },
  };
  private static readonly SILENCE = 0.0001;

  private line: { oscillator: OscillatorNode; envelope: GainNode } | null = null;

  /**
   * Crea los sonidos.
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   */
  public constructor(
    private readonly context: AudioContext,
    private readonly output: AudioNode,
  ) {}

  /**
   * Timbre: dos ráfagas de campanilla.
   */
  public ring(): void {
    const { tones, pulse, pulses, bursts, gap, gain } = PhoneSound.RING;
    const start = this.context.currentTime;
    for (let index = 0; index < bursts * pulses; index++) {
      const burst = Math.floor(index / pulses);
      const at = start + index * pulse + burst * gap;
      const tone = tones[index % tones.length] ?? { hz: 0 };
      this.beep(tone.hz, at, pulse, gain);
    }
  }

  /**
   * Tono DTMF de una tecla (suma de la frecuencia de su fila y la de su columna).
   *
   * @param row Fila de la tecla (0 = arriba).
   * @param column Columna de la tecla (0 = izquierda).
   */
  public key(row: number, column: number): void {
    const { rows, columns, gain, duration } = PhoneSound.DTMF;
    const start = this.context.currentTime;
    [rows[row], columns[column]].forEach((tone) => {
      if (tone) {
        this.beep(tone.hz, start, duration, gain);
      }
    });
  }

  /**
   * Cambia el tono de la línea (el anterior se apaga).
   *
   * @param line Tono nuevo.
   */
  public setLine(line: PhoneLine): void {
    this.stopLine();
    const cadence = PhoneSound.CADENCE[line];
    if (!cadence) {
      return;
    }
    const { hz, gain, span } = PhoneSound.LINE;
    const start = this.context.currentTime;
    const oscillator = new OscillatorNode(this.context, { type: 'sine', frequency: hz });
    const envelope = new GainNode(this.context, { gain: 0 });
    for (let at = 0; at < span; at += cadence.on + cadence.off) {
      envelope.gain.setValueAtTime(gain, start + at);
      envelope.gain.setValueAtTime(0, start + at + cadence.on);
    }
    oscillator.connect(envelope).connect(this.output);
    oscillator.start(start);
    oscillator.stop(start + span);
    this.line = { oscillator, envelope };
  }

  /**
   * Apaga el tono de la línea con una rampa corta (sin chasquido).
   */
  private stopLine(): void {
    if (!this.line) {
      return;
    }
    const { oscillator, envelope } = this.line;
    const now = this.context.currentTime;
    envelope.gain.cancelScheduledValues(now);
    envelope.gain.setValueAtTime(envelope.gain.value, now);
    envelope.gain.linearRampToValueAtTime(0, now + PhoneSound.LINE.fade);
    oscillator.stop(now + PhoneSound.LINE.fade);
    this.line = null;
  }

  /**
   * Tono senoidal corto con caída exponencial.
   *
   * @param frequency Frecuencia en Hz.
   * @param start Instante de inicio.
   * @param duration Duración.
   * @param gain Volumen inicial.
   */
  private beep(frequency: number, start: number, duration: number, gain: number): void {
    const oscillator = new OscillatorNode(this.context, { type: 'sine', frequency });
    const envelope = new GainNode(this.context, { gain });
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(PhoneSound.SILENCE, start + duration);
    oscillator.connect(envelope).connect(this.output);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }
}
