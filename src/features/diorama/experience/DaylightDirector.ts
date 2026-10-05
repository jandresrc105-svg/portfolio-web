import { gsap } from 'gsap';
import { DayPhase } from '@shared/theme/DayPhase';
import type { LensSettings } from '@shared/engine/LensSettings';
import { PostProcessing } from '@shared/engine/PostProcessing';
import type { Stage } from '@shared/engine/Stage';
import type { DaylightAware } from '../models/DaylightAware';
import type { DaylightEnvironments } from '../models/DaylightEnvironments';
import type { DaylightKey } from '../models/DaylightKey';

/**
 * Lleva la escena entre la noche, la tarde y el día con un solo valor (0 = noche, 0,5 = tarde, 1 = día) que se
 * anima como un amanecer o un atardecer de unos segundos (de la noche al día se pasa por la tarde) y se reparte
 * entre las piezas que cambian con la hora, el mapa de entorno (neón de noche, atardecer de tarde, cielo de
 * día: se cambia a mitad de cada tramo, con poca intensidad) y el post-procesado (de día el bloom solo toma lo
 * que de verdad brilla y la viñeta casi desaparece). Nada agrega ni quita luces ni cambia materiales: solo
 * valores, así que el cambio no recompila shaders.
 */
export class DaylightDirector {
  private static readonly SECONDS = 3.2;
  private static readonly EASE = 'sine.inOut';
  private static readonly HALF = 0.5;
  private static readonly MS_PER_SECOND = 1000;
  private static readonly DIP = 0.2;
  private static readonly LEVELS: ReadonlyMap<DayPhase, number> = new Map([
    [DayPhase.Night, 0],
    [DayPhase.Dusk, 0.5],
    [DayPhase.Day, 1],
  ]);
  private static readonly KEYS: readonly DaylightKey[] = [
    { at: 0, environment: 'night', intensity: 0.5, lens: PostProcessing.defaults },
    { at: 0.5, environment: 'dusk', intensity: 0.45, lens: { bloom: 1.1, threshold: 1.1, vignette: 0.45 } },
    { at: 1, environment: 'day', intensity: 0.7, lens: { bloom: 0.55, threshold: 2.6, vignette: 0.28 } },
  ];

  /** Milisegundos desde que empieza un cambio completo hasta su mitad (cuando el cielo pasa por la tarde). */
  public static readonly HALFWAY_MS =
    DaylightDirector.SECONDS * DaylightDirector.HALF * DaylightDirector.MS_PER_SECOND;

  private readonly progress = { value: -1 };
  private tween: gsap.core.Tween | null = null;

  /**
   * Prepara el director.
   *
   * @param stage Escenario (mapa de entorno y post-procesado).
   * @param environments Mapas de entorno ya horneados de la noche, la tarde y el día.
   * @param pieces Piezas que cambian con la hora.
   * @param wake Mantiene el bucle a ritmo completo mientras dura el cambio.
   */
  public constructor(
    private readonly stage: Stage,
    private readonly environments: DaylightEnvironments,
    private readonly pieces: readonly DaylightAware[],
    private readonly wake: () => void,
  ) {}

  /**
   * Cambia a un momento del día.
   *
   * @param phase Momento del día.
   * @param instant Sin animación (al cargar la escena).
   */
  public show(phase: DayPhase, instant: boolean): void {
    const target = DaylightDirector.LEVELS.get(phase) ?? 0;
    this.tween?.kill();
    if (instant || this.progress.value < 0) {
      this.apply(target);
      return;
    }
    this.tween = gsap.to(this.progress, {
      value: target,
      duration: DaylightDirector.SECONDS * Math.abs(target - this.progress.value),
      ease: DaylightDirector.EASE,
      onUpdate: () => {
        this.apply(this.progress.value);
      },
    });
  }

  /**
   * Detiene el cambio en curso.
   */
  public dispose(): void {
    this.tween?.kill();
  }

  /**
   * Aplica un momento del día a toda la escena.
   *
   * @param level 0 = noche, 0,5 = tarde, 1 = día.
   */
  private apply(level: number): void {
    this.progress.value = level;
    this.pieces.forEach((piece) => {
      piece.setDaylight(level);
    });
    const segment = DaylightDirector.segment(level);
    if (segment) {
      const { from, to, t } = segment;
      this.applyEnvironment(from, to, t);
      this.stage.setLens(DaylightDirector.lens(from.lens, to.lens, t));
    }
    this.wake();
  }

  /**
   * Mapa de entorno de un tramo: el del primer momento hasta la mitad y el del segundo desde ahí, con la
   * intensidad baja justo en el cambio para que no se note el salto.
   *
   * @param from Momento donde empieza el tramo.
   * @param to Momento donde termina.
   * @param t Avance dentro del tramo [0, 1].
   */
  private applyEnvironment(from: DaylightKey, to: DaylightKey, t: number): void {
    const half = DaylightDirector.HALF;
    const current = t < half ? from : to;
    const edge = Math.abs(t - half) / half;
    const dip = DaylightDirector.DIP;
    this.stage.setEnvironment(this.environments[current.environment], dip + (current.intensity - dip) * edge);
  }

  /**
   * Tramo entre dos momentos clave donde cae un momento del día.
   *
   * @param level Momento del día.
   * @returns Momentos que lo rodean y avance entre ellos, o `null` si no hay tramo.
   */
  private static segment(level: number): { from: DaylightKey; to: DaylightKey; t: number } | null {
    const keys = DaylightDirector.KEYS;
    const index = Math.min(
      Math.max(
        keys.findIndex((key) => key.at >= level),
        1,
      ),
      keys.length - 1,
    );
    const from = keys[index - 1];
    const to = keys[index];
    return from && to ? { from, to, t: (level - from.at) / (to.at - from.at) } : null;
  }

  /**
   * Ajustes del post-procesado entre dos momentos.
   *
   * @param from Ajustes del primer momento.
   * @param to Ajustes del segundo.
   * @param t Avance [0, 1].
   * @returns Bloom, umbral y viñeta mezclados.
   */
  private static lens(from: LensSettings, to: LensSettings, t: number): LensSettings {
    const mix = (a: number, b: number): number => a + (b - a) * t;
    return {
      bloom: mix(from.bloom, to.bloom),
      threshold: mix(from.threshold, to.threshold),
      vignette: mix(from.vignette, to.vignette),
    };
  }
}
