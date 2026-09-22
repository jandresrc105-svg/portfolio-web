import type { Stage } from './Stage';
import type { Updatable } from './Updatable';

/**
 * Mantiene la fluidez midiendo los FPS reales y bajando la resolución interna del render por escalones
 * cuando el equipo no alcanza el objetivo. Solo baja (nunca sube) para evitar oscilaciones visibles.
 */
export class AdaptiveResolution implements Updatable {
  private static readonly TARGET_FPS = 50;
  private static readonly SAMPLE_SECONDS = 2;
  private static readonly WARMUP_SECONDS = 1.5;
  private static readonly STEP = 0.2;
  private static readonly MIN_SCALE = 0.55;

  private scale = 1;
  private frames = 0;
  private seconds = 0;
  private warmup = AdaptiveResolution.WARMUP_SECONDS;

  /**
   * Crea el regulador.
   *
   * @param stage Escenario cuya resolución se ajusta.
   */
  public constructor(private readonly stage: Stage) {}

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    if (this.warmup > 0) {
      this.warmup -= delta;
      return;
    }
    this.frames += 1;
    this.seconds += delta;
    if (this.seconds < AdaptiveResolution.SAMPLE_SECONDS) {
      return;
    }
    this.evaluate(this.frames / this.seconds);
    this.frames = 0;
    this.seconds = 0;
  }

  /**
   * Baja un escalón de resolución si los FPS medidos están por debajo del objetivo.
   *
   * @param fps FPS promedio de la última muestra.
   */
  private evaluate(fps: number): void {
    if (fps >= AdaptiveResolution.TARGET_FPS || this.scale <= AdaptiveResolution.MIN_SCALE) {
      return;
    }
    this.scale = Math.max(this.scale - AdaptiveResolution.STEP, AdaptiveResolution.MIN_SCALE);
    this.stage.setResolutionScale(this.scale);
  }
}
