import type { AudioEngine } from '@shared/audio/AudioEngine';
import type { QualityDetector } from '@shared/engine/QualityDetector';
import { Soundscape } from '../audio/Soundscape';
import type { Weather } from '../models/Weather';
import type { DioramaDevices } from '../models/DioramaDevices';
import { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import { DioramaExperience } from './DioramaExperience';

/**
 * Fábrica de la experiencia 3D (patrón Factory): decide calidad, verifica soporte y precarga las fuentes
 * que se dibujan en los letreros, para que el componente no conozca esos detalles.
 */
export class DioramaExperienceFactory {
  private static readonly WEATHER: Weather = { rain: false, storm: false, backdrop: false, fog: false };
  private static readonly FONT_SAMPLES = [
    {
      font: `900 64px ${CanvasTextureFactory.JAPANESE_FONT}`,
      text: 'ラーメンらめん麺灯醤油味噌豚骨塩餃子電子部品',
    },
    {
      font: `800 64px ${CanvasTextureFactory.MONO_FONT}`,
      text: 'RAMEN & CIRCUITS REPAIR · LAB TECNOLOGÍAS ¥0123456789 </> .NET C++ µPy aws JS TS A Ω°',
    },
    { font: `800 64px ${CanvasTextureFactory.SANS_FONT}`, text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚ ·./+#' },
  ];

  /**
   * Crea la fábrica.
   *
   * @param quality Detector de capacidad del dispositivo.
   * @param devices Osciloscopio y teléfono que el visitante usa.
   * @param audio Motor de audio compartido.
   */
  public constructor(
    private readonly quality: QualityDetector,
    private readonly devices: DioramaDevices,
    private readonly audio: AudioEngine,
  ) {}

  /**
   * Indica si el dispositivo puede mostrar la experiencia 3D.
   *
   * @returns `true` si hay WebGL2.
   */
  public isSupported(): boolean {
    return this.quality.supportsWebGl();
  }

  /**
   * Indica si se debe saltar la animación de la intro.
   *
   * @returns `true` si el usuario prefiere movimiento reducido.
   */
  public prefersReducedMotion(): boolean {
    return this.quality.prefersReducedMotion();
  }

  /**
   * Arranca el audio: suena de inmediato si el navegador lo permite o con la primera interacción del visitante.
   */
  public startSound(): void {
    this.audio.start();
  }

  /**
   * Precarga las fuentes usadas en las texturas de canvas; si fallan se usan las del sistema.
   *
   * @returns Promesa que se resuelve cuando las fuentes están listas o fallaron.
   */
  public async loadFonts(): Promise<void> {
    const loads = DioramaExperienceFactory.FONT_SAMPLES.map(({ font, text }) =>
      document.fonts.load(font, text),
    );
    await Promise.allSettled(loads);
  }

  /**
   * Crea la experiencia sobre un canvas.
   *
   * @param canvas Canvas destino.
   * @returns Experiencia lista para preparar.
   */
  public create(canvas: HTMLCanvasElement): DioramaExperience {
    const weather = DioramaExperienceFactory.WEATHER;
    const sound = new Soundscape(this.audio, weather.rain);
    return new DioramaExperience(canvas, this.quality.detect(), this.devices, sound, weather);
  }
}
