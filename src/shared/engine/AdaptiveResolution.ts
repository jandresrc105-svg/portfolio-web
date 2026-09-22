import type { Stage } from './Stage';
import type { Updatable } from './Updatable';

/**
 * Mantiene la animación fluida ajustando la resolución interna del render según la regularidad de los frames,
 * no según el promedio de FPS (un promedio de 50 FPS puede esconder frames alternos de 16 y 33 ms que se ven
 * como tirones):
 * - baja un escalón si más del 15 % de los frames es lento en dos muestras seguidas;
 * - sube un escalón (hasta supersampling) solo si casi ningún frame es lento;
 * - la escala que falló queda como techo definitivo, para no alternar entre dos resoluciones.
 */
export class AdaptiveResolution implements Updatable {
  private static readonly SLOW_FRAME_SECONDS = 0.022;
  private static readonly RATIO = { downgrade: 0.15, upgrade: 0.05 };
  private static readonly SAMPLE_SECONDS = 1.5;
  private static readonly WARMUP_SECONDS = 4;
  private static readonly UPGRADE_COOLDOWN = 5;
  private static readonly STEP = 0.15;
  private static readonly MIN_SCALE = 0.5;
  private static readonly BAD_SAMPLES = 2;

  private scale = 1;
  private ceiling: number;
  private readonly maxScale: number;
  private frames = 0;
  private slowFrames = 0;
  private seconds = 0;
  private warmup = AdaptiveResolution.WARMUP_SECONDS;
  private sinceChange = 0;
  private badStreak = 0;

  /**
   * Crea el regulador.
   *
   * @param stage Escenario cuya resolución se ajusta.
   * @param maxScale Escala máxima permitida por el perfil de calidad.
   */
  public constructor(
    private readonly stage: Stage,
    maxScale: number,
  ) {
    this.ceiling = maxScale;
    this.maxScale = maxScale;
  }

  /**
   * Olvida los techos aprendidos durante una fase excepcionalmente pesada (la intro)
   * y permite volver a subir pronto la resolución.
   */
  public release(): void {
    this.ceiling = this.maxScale;
    this.badStreak = 0;
    this.sinceChange = AdaptiveResolution.UPGRADE_COOLDOWN;
  }

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    if (this.warmup > 0) {
      this.warmup -= delta;
      return;
    }
    this.frames += 1;
    this.slowFrames += delta > AdaptiveResolution.SLOW_FRAME_SECONDS ? 1 : 0;
    this.seconds += delta;
    this.sinceChange += delta;
    if (this.seconds < AdaptiveResolution.SAMPLE_SECONDS) {
      return;
    }
    this.evaluate(this.slowFrames / this.frames);
    this.frames = 0;
    this.slowFrames = 0;
    this.seconds = 0;
  }

  /**
   * Decide si bajar, subir o mantener la resolución.
   *
   * @param slowRatio Fracción de frames lentos en la última muestra.
   */
  private evaluate(slowRatio: number): void {
    const { RATIO, STEP, MIN_SCALE, UPGRADE_COOLDOWN, BAD_SAMPLES } = AdaptiveResolution;
    this.badStreak = slowRatio > RATIO.downgrade ? this.badStreak + 1 : 0;
    if (this.badStreak >= BAD_SAMPLES && this.scale > MIN_SCALE) {
      this.ceiling = Math.max(this.scale - STEP, MIN_SCALE);
      this.apply(this.ceiling);
      return;
    }
    const canGrow = this.scale + STEP <= this.ceiling + Number.EPSILON;
    if (slowRatio < RATIO.upgrade && canGrow && this.sinceChange > UPGRADE_COOLDOWN) {
      this.apply(this.scale + STEP);
    }
  }

  /**
   * Aplica una escala y reinicia los contadores de cambio.
   *
   * @param scale Nueva escala.
   */
  private apply(scale: number): void {
    this.scale = scale;
    this.sinceChange = 0;
    this.badStreak = 0;
    this.stage.setResolutionScale(scale);
  }
}
