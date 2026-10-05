import { gsap } from 'gsap';
import type { Texture } from 'three';
import type { LensSettings } from '@shared/engine/LensSettings';
import { PostProcessing } from '@shared/engine/PostProcessing';
import type { Stage } from '@shared/engine/Stage';
import type { DaylightAware } from '../models/DaylightAware';

/**
 * Lleva la escena entre la noche y el día con un solo valor (0 = noche, 1 = día) que se anima como un
 * amanecer o un atardecer de unos segundos y se reparte entre las piezas que cambian con la hora, el mapa de
 * entorno (el de neón de noche, el del cielo de día: se cambia a mitad del paso, con poca intensidad) y el
 * post-procesado (de día el bloom solo toma lo que de verdad brilla y la viñeta casi desaparece). Nada agrega
 * ni quita luces ni cambia materiales: solo valores, así que el cambio no recompila shaders.
 */
export class DaylightDirector {
  private static readonly SECONDS = 3.2;
  private static readonly EASE = 'sine.inOut';
  private static readonly SWAP = 0.5;
  private static readonly MS_PER_SECOND = 1000;
  private static readonly ENVIRONMENT = { night: 0.5, day: 0.7, dip: 0.25 };
  private static readonly DAY_LENS: LensSettings = { bloom: 0.55, threshold: 2.6, vignette: 0.28 };

  /** Milisegundos desde que empieza un cambio completo hasta su mitad (cuando el cielo cruza). */
  public static readonly HALFWAY_MS =
    DaylightDirector.SECONDS * DaylightDirector.SWAP * DaylightDirector.MS_PER_SECOND;

  private readonly progress = { value: -1 };
  private tween: gsap.core.Tween | null = null;

  /**
   * Prepara el director.
   *
   * @param stage Escenario (mapa de entorno y post-procesado).
   * @param environments Mapas de entorno ya horneados.
   * @param environments.night Mapa de entorno de la noche.
   * @param environments.day Mapa de entorno del día.
   * @param pieces Piezas que cambian con la hora.
   * @param wake Mantiene el bucle a ritmo completo mientras dura el cambio.
   */
  public constructor(
    private readonly stage: Stage,
    private readonly environments: { readonly night: Texture; readonly day: Texture },
    private readonly pieces: readonly DaylightAware[],
    private readonly wake: () => void,
  ) {}

  /**
   * Cambia a la noche o al día.
   *
   * @param day `true` para el día.
   * @param instant Sin animación (al cargar la escena).
   */
  public show(day: boolean, instant: boolean): void {
    const target = day ? 1 : 0;
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
   * @param level 0 = noche, 1 = día.
   */
  private apply(level: number): void {
    this.progress.value = level;
    this.pieces.forEach((piece) => {
      piece.setDaylight(level);
    });
    this.applyEnvironment(level);
    this.stage.setLens(DaylightDirector.lens(level));
    this.wake();
  }

  /**
   * Mapa de entorno del momento: el de la noche hasta la mitad del paso y el del día desde ahí, con la
   * intensidad baja justo en el cambio para que no se note el salto.
   *
   * @param level Momento del día.
   */
  private applyEnvironment(level: number): void {
    const { night, day, dip } = DaylightDirector.ENVIRONMENT;
    const swap = DaylightDirector.SWAP;
    const edge = Math.abs(level - swap) / swap;
    const base = level < swap ? night : day;
    const intensity = dip + (base - dip) * edge;
    this.stage.setEnvironment(level < swap ? this.environments.night : this.environments.day, intensity);
  }

  /**
   * Ajustes del post-procesado del momento.
   *
   * @param level Momento del día.
   * @returns Bloom, umbral y viñeta mezclados.
   */
  private static lens(level: number): LensSettings {
    const night = PostProcessing.defaults;
    const day = DaylightDirector.DAY_LENS;
    const mix = (from: number, to: number): number => from + (to - from) * level;
    return {
      bloom: mix(night.bloom, day.bloom),
      threshold: mix(night.threshold, day.threshold),
      vignette: mix(night.vignette, day.vignette),
    };
  }
}
