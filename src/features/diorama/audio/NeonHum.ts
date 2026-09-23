import type { Powerable } from '../models/Powerable';

/**
 * Zumbido del tubo de neón: armónicos de 120 Hz (el doble de la red eléctrica de 60 Hz, como un balastro real).
 * Sigue el brillo del letrero (baja cuando parpadea) y la distancia de la cámara al letrero.
 */
export class NeonHum implements Powerable {
  private static readonly HARMONICS: readonly { frequency: number; type: OscillatorType; gain: number }[] = [
    { frequency: 120, type: 'sawtooth', gain: 0.5 },
    { frequency: 240, type: 'sine', gain: 0.3 },
    { frequency: 360, type: 'sine', gain: 0.18 },
  ];
  private static readonly LOWPASS = 600;
  private static readonly VOLUME = 0.012;
  private static readonly SMOOTHING = 0.025;
  private static readonly HEARING = { near: 2.5, far: 16 };

  private readonly volume: GainNode;
  private level = 0;
  private proximity = 0;

  /**
   * Crea el zumbido y arranca sus osciladores (en silencio hasta que haya energía).
   *
   * @param context Contexto de audio.
   * @param output Nodo de salida.
   */
  public constructor(
    private readonly context: AudioContext,
    output: AudioNode,
  ) {
    this.volume = new GainNode(context, { gain: 0 });
    const filter = new BiquadFilterNode(context, { type: 'lowpass', frequency: NeonHum.LOWPASS });
    filter.connect(this.volume).connect(output);
    NeonHum.HARMONICS.forEach(({ frequency, type, gain }) => {
      const oscillator = new OscillatorNode(context, { frequency, type });
      oscillator.connect(new GainNode(context, { gain })).connect(filter);
      oscillator.start();
    });
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.apply();
  }

  /**
   * Ajusta el volumen según la distancia del oyente (la cámara) al letrero.
   *
   * @param distance Distancia en metros.
   */
  public setDistance(distance: number): void {
    const { near, far } = NeonHum.HEARING;
    const closeness = 1 - Math.min(Math.max((distance - near) / (far - near), 0), 1);
    this.proximity = closeness ** 2;
    this.apply();
  }

  /**
   * Aplica el volumen resultante con un suavizado corto para evitar chasquidos.
   */
  private apply(): void {
    const target = this.level * this.proximity * NeonHum.VOLUME;
    this.volume.gain.setTargetAtTime(target, this.context.currentTime, NeonHum.SMOOTHING);
  }
}
