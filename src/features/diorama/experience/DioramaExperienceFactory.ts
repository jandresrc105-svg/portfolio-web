import type { QualityDetector } from '@shared/engine/QualityDetector';
import type { SignalService } from '../services/SignalService';
import { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import { DioramaExperience } from './DioramaExperience';

/**
 * Fábrica de la experiencia 3D (patrón Factory): decide calidad, verifica soporte y precarga las fuentes
 * que se dibujan en los letreros, para que el componente no conozca esos detalles.
 */
export class DioramaExperienceFactory {
  private static readonly FONT_SAMPLES = [
    { font: `900 64px ${CanvasTextureFactory.JAPANESE_FONT}`, text: 'ラーメンらめん麺灯醤油味噌豚骨塩餃子' },
    { font: `700 64px ${CanvasTextureFactory.MONO_FONT}`, text: 'RAMEN & CIRCUITS PROYECTOS ¥0123456789' },
  ];

  /**
   * Crea la fábrica.
   *
   * @param quality Detector de capacidad del dispositivo.
   * @param signal Service del lazo de control.
   */
  public constructor(
    private readonly quality: QualityDetector,
    private readonly signal: SignalService,
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
    return new DioramaExperience(canvas, this.quality.detect(), this.signal);
  }
}
