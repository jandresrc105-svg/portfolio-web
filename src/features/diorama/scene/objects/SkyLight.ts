import { Color, DirectionalLight, FogExp2, HemisphereLight, type Scene } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { DaylightAware } from '../../models/DaylightAware';

/**
 * Cielo de la escena, de noche o de día: fondo, niebla opcional del color del horizonte, luz de cielo, luna fría
 * que recorta las siluetas, un contraluz magenta y el sol. Las cuatro luces existen siempre y solo cambian de
 * color e intensidad con la hora ({@link SkyLight.setDaylight}): agregar o quitar luces recompilaría los shaders
 * de toda la escena. De día el sol entra cálido por delante a la derecha y la luna queda como luz fría de
 * relleno.
 * La luna es pública porque la tormenta la refuerza durante los relámpagos.
 */
export class SkyLight extends SceneObject implements DaylightAware {
  private static readonly FOG_DENSITY = 0.018;
  private static readonly NIGHT = {
    haze: 0x0b0919,
    sky: 0x3a4a82,
    ground: 0x0a0a12,
    hemisphere: 0.6,
    moon: 0x7d95ff,
    rim: 0.35,
    sun: 0,
  };
  private static readonly DAY = {
    haze: 0x6fb4ee,
    sky: 0xd6eaff,
    ground: 0x8a7356,
    hemisphere: 0.9,
    moon: 0xcfe2ff,
    rim: 0.1,
    sun: 9,
  };
  private static readonly MOON = { intensity: 0.9, x: -9, y: 14, z: -6 };
  private static readonly RIM = { color: 0xff3d8b, x: 8, y: 3, z: -10 };
  private static readonly SUN = { color: 0xffd9a8, x: 7, y: 12, z: 10 };

  public readonly moon = new DirectionalLight(SkyLight.NIGHT.moon, SkyLight.MOON.intensity);

  private readonly hemisphere = new HemisphereLight(SkyLight.NIGHT.sky, SkyLight.NIGHT.ground);
  private readonly rim = new DirectionalLight(SkyLight.RIM.color);
  private readonly sun = new DirectionalLight(SkyLight.SUN.color);
  private readonly background = new Color();
  private readonly palette = {
    night: SkyLight.colors(SkyLight.NIGHT),
    day: SkyLight.colors(SkyLight.DAY),
  };

  /**
   * Crea el cielo.
   *
   * @param scene Escena a la que se aplica el fondo y la niebla.
   * @param fog Si se agrega niebla.
   */
  public constructor(
    private readonly scene: Scene,
    private readonly fog: boolean,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setDaylight(level: number): void {
    const { night, day } = this.palette;
    this.background.lerpColors(night.haze, day.haze, level);
    this.hemisphere.color.lerpColors(night.sky, day.sky, level);
    this.hemisphere.groundColor.lerpColors(night.ground, day.ground, level);
    this.moon.color.lerpColors(night.moon, day.moon, level);
    this.hemisphere.intensity = SkyLight.mix(SkyLight.NIGHT.hemisphere, SkyLight.DAY.hemisphere, level);
    this.rim.intensity = SkyLight.mix(SkyLight.NIGHT.rim, SkyLight.DAY.rim, level);
    this.sun.intensity = SkyLight.mix(SkyLight.NIGHT.sun, SkyLight.DAY.sun, level);
    if (this.scene.fog instanceof FogExp2) {
      this.scene.fog.color.copy(this.background);
    }
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.scene.background = this.background;
    this.scene.fog = this.fog ? new FogExp2(SkyLight.NIGHT.haze, SkyLight.FOG_DENSITY) : null;
    this.add(this.hemisphere);
    this.add(this.moon, SkyLight.MOON);
    this.add(this.rim, SkyLight.RIM);
    this.add(this.sun, SkyLight.SUN);
    this.setDaylight(0);
  }

  /**
   * Colores de un momento del día.
   *
   * @param moment Colores de la noche o del día.
   * @returns Colores listos para mezclar.
   */
  private static colors(moment: typeof SkyLight.NIGHT): Record<'haze' | 'sky' | 'ground' | 'moon', Color> {
    return {
      haze: new Color(moment.haze),
      sky: new Color(moment.sky),
      ground: new Color(moment.ground),
      moon: new Color(moment.moon),
    };
  }

  /**
   * Interpola entre dos valores.
   *
   * @param from Valor de noche.
   * @param to Valor de día.
   * @param level Momento del día.
   * @returns Valor mezclado.
   */
  private static mix(from: number, to: number, level: number): number {
    return from + (to - from) * level;
  }
}
