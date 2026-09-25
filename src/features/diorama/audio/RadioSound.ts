import type { AudioEngine } from '@shared/audio/AudioEngine';
import type { RadioAudio } from '../models/RadioAudio';
import { RadioMode } from '../models/RadioMode';

/**
 * Parlante del receptor de radio, sintetizado con Web Audio: ruido blanco filtrado en la banda de la voz (el
 * soplido de la banda, que baja cuando entra una señal) y un oscilador para el tono demodulado (senoidal de
 * ~700 Hz con el manipulado del morse en CW, triangular con la melodía en AM). Los nodos se crean la
 * primera vez que el navegador permite sonar; los cambios usan rampas cortas para no chasquear.
 */
export class RadioSound {
  private static readonly NOISE = { seconds: 2, gain: 0.028, center: 1400, q: 0.7 };
  private static readonly TONE = { gain: 0.04, am: 0.022, pitch: 700 };
  private static readonly RAMP = { key: 0.004, level: 0.06, pitch: 0.02 };
  private static readonly EPSILON = 0.002;
  private static readonly WAVES: Record<RadioMode, OscillatorType> = {
    [RadioMode.Am]: 'triangle',
    [RadioMode.Cw]: 'sine',
  };

  private voices: {
    context: AudioContext;
    noise: AudioBufferSourceNode;
    noiseGain: GainNode;
    oscillator: OscillatorNode;
    toneGain: GainNode;
  } | null = null;
  private last: RadioAudio | null = null;

  /**
   * Crea el parlante.
   *
   * @param engine Motor de audio compartido.
   */
  public constructor(private readonly engine: AudioEngine) {}

  /**
   * Hace sonar lo que entrega el receptor (solo toca los nodos si algo cambió).
   *
   * @param audio Niveles y tono.
   */
  public play(audio: RadioAudio): void {
    const silent = audio.noise === 0 && audio.tone === 0;
    if (!this.voices && silent) {
      return;
    }
    const voices = this.voices ?? this.create();
    if (voices && this.changed(audio)) {
      this.apply(voices, audio);
    }
  }

  /**
   * Detiene y desconecta los nodos.
   */
  public dispose(): void {
    if (!this.voices) {
      return;
    }
    const { noise, oscillator, noiseGain, toneGain } = this.voices;
    noise.stop();
    oscillator.stop();
    noiseGain.disconnect();
    toneGain.disconnect();
    this.voices = null;
  }

  /**
   * Lleva los niveles y el tono a los nodos con rampas cortas.
   *
   * @param voices Nodos.
   * @param audio Niveles y tono.
   */
  private apply(voices: NonNullable<RadioSound['voices']>, audio: RadioAudio): void {
    const { context, noiseGain, toneGain, oscillator } = voices;
    const now = context.currentTime;
    const { key, level, pitch } = RadioSound.RAMP;
    const toneLevel = audio.mode === RadioMode.Cw ? RadioSound.TONE.gain : RadioSound.TONE.am;
    noiseGain.gain.setTargetAtTime(audio.noise * RadioSound.NOISE.gain, now, level);
    toneGain.gain.setTargetAtTime(audio.tone * toneLevel, now, audio.mode === RadioMode.Cw ? key : level);
    oscillator.frequency.setTargetAtTime(audio.pitch, now, pitch);
    oscillator.type = RadioSound.WAVES[audio.mode];
    this.last = audio;
  }

  /**
   * Indica si lo que hay que tocar cambió lo suficiente para mover los nodos.
   *
   * @param audio Niveles y tono nuevos.
   * @returns `true` si cambió.
   */
  private changed(audio: RadioAudio): boolean {
    const last = this.last;
    if (last?.mode !== audio.mode) {
      return true;
    }
    const epsilon = RadioSound.EPSILON;
    return (
      Math.abs(last.noise - audio.noise) > epsilon ||
      Math.abs(last.tone - audio.tone) > epsilon ||
      Math.abs(last.pitch - audio.pitch) > 1
    );
  }

  /**
   * Crea los nodos si el navegador ya permite sonar.
   *
   * @returns Nodos, o `null` si todavía no hay audio.
   */
  private create(): RadioSound['voices'] {
    const context = this.engine.audioContext;
    const output = this.engine.output;
    if (!context || !output) {
      return null;
    }
    const { center, q } = RadioSound.NOISE;
    const noise = new AudioBufferSourceNode(context, { buffer: RadioSound.whiteNoise(context), loop: true });
    const filter = new BiquadFilterNode(context, { type: 'bandpass', frequency: center, Q: q });
    const noiseGain = new GainNode(context, { gain: 0 });
    const oscillator = new OscillatorNode(context, { type: 'sine', frequency: RadioSound.TONE.pitch });
    const toneGain = new GainNode(context, { gain: 0 });
    noise.connect(filter).connect(noiseGain).connect(output);
    oscillator.connect(toneGain).connect(output);
    noise.start();
    oscillator.start();
    this.voices = { context, noise, noiseGain, oscillator, toneGain };
    return this.voices;
  }

  /**
   * Búfer de ruido blanco para repetir en bucle.
   *
   * @param context Contexto de audio.
   * @returns Búfer.
   */
  private static whiteNoise(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * RadioSound.NOISE.seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    data.forEach((_value, index) => {
      data[index] = Math.random() * 2 - 1;
    });
    return buffer;
  }
}
