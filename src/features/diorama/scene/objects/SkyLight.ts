import { Color, DirectionalLight, FogExp2, HemisphereLight, type Scene } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { DaylightAware } from '../../models/DaylightAware';

/**
 * Cielo de la escena, de noche, de tarde o de día: fondo, niebla opcional del color del horizonte, luz de
 * cielo, luna fría que recorta las siluetas, un contraluz bajo detrás del puesto y el sol alto por delante a la
 * derecha. Las cuatro luces existen siempre y solo cambian de color e intensidad con la hora
 * ({@link SkyLight.setDaylight}): agregar o quitar luces recompilaría los shaders de toda la escena. De noche el
 * contraluz es magenta (el reflejo de la ciudad); de tarde es el sol naranja que se pone detrás del puesto; de
 * día queda casi apagado y manda el sol alto, con la luna como luz fría de relleno.
 * La luna es pública porque la tormenta la refuerza durante los relámpagos.
 */
export class SkyLight extends SceneObject implements DaylightAware {
  private static readonly FOG_DENSITY = 0.018;
  private static readonly DUSK_AT = 0.5;
  private static readonly MOMENTS = [
    {
      haze: 0x0b0919,
      sky: 0x3a4a82,
      ground: 0x0a0a12,
      moon: 0x7d95ff,
      rim: 0xff3d8b,
      hemisphere: 0.6,
      rimIntensity: 0.35,
      sun: 0,
    },
    {
      haze: 0xcc6b5c,
      sky: 0xffb08a,
      ground: 0x2c2236,
      moon: 0x9c8cff,
      rim: 0xff8a3d,
      hemisphere: 0.75,
      rimIntensity: 5,
      sun: 1.6,
    },
    {
      haze: 0x6fb4ee,
      sky: 0xd6eaff,
      ground: 0x8a7356,
      moon: 0xcfe2ff,
      rim: 0xffd2a8,
      hemisphere: 0.9,
      rimIntensity: 0.1,
      sun: 9,
    },
  ];
  private static readonly MOON = { color: 0x7d95ff, intensity: 0.9, x: -9, y: 14, z: -6 };
  private static readonly RIM = { x: 8, y: 3, z: -10 };
  private static readonly SUN = { color: 0xffd9a8, x: 7, y: 12, z: 10 };

  public readonly moon = new DirectionalLight(SkyLight.MOON.color, SkyLight.MOON.intensity);

  private readonly hemisphere = new HemisphereLight();
  private readonly rim = new DirectionalLight();
  private readonly sun = new DirectionalLight(SkyLight.SUN.color);
  private readonly background = new Color();
  private readonly palettes = SkyLight.MOMENTS.map((moment) => ({
    ...moment,
    colors: {
      haze: new Color(moment.haze),
      sky: new Color(moment.sky),
      ground: new Color(moment.ground),
      moon: new Color(moment.moon),
      rim: new Color(moment.rim),
    },
  }));

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
    const dusk = SkyLight.DUSK_AT;
    const [night, evening, day] = this.palettes;
    const late = level >= dusk;
    const from = late ? evening : night;
    const to = late ? day : evening;
    if (from && to) {
      this.blend(from, to, late ? (level - dusk) / (1 - dusk) : level / dusk);
    }
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.scene.background = this.background;
    this.scene.fog = this.fog ? new FogExp2(this.background, SkyLight.FOG_DENSITY) : null;
    this.add(this.hemisphere);
    this.add(this.moon, SkyLight.MOON);
    this.add(this.rim, SkyLight.RIM);
    this.add(this.sun, SkyLight.SUN);
    this.setDaylight(0);
  }

  /**
   * Mezcla dos momentos del día en el fondo, la niebla y las luces.
   *
   * @param from Momento anterior.
   * @param to Momento siguiente.
   * @param t Avance entre ellos [0, 1].
   */
  private blend(from: SkyLight['palettes'][number], to: SkyLight['palettes'][number], t: number): void {
    this.background.lerpColors(from.colors.haze, to.colors.haze, t);
    this.hemisphere.color.lerpColors(from.colors.sky, to.colors.sky, t);
    this.hemisphere.groundColor.lerpColors(from.colors.ground, to.colors.ground, t);
    this.moon.color.lerpColors(from.colors.moon, to.colors.moon, t);
    this.rim.color.lerpColors(from.colors.rim, to.colors.rim, t);
    this.hemisphere.intensity = SkyLight.mix(from.hemisphere, to.hemisphere, t);
    this.rim.intensity = SkyLight.mix(from.rimIntensity, to.rimIntensity, t);
    this.sun.intensity = SkyLight.mix(from.sun, to.sun, t);
    if (this.scene.fog instanceof FogExp2) {
      this.scene.fog.color.copy(this.background);
    }
  }

  /**
   * Interpola entre dos valores.
   *
   * @param from Valor del momento anterior.
   * @param to Valor del momento siguiente.
   * @param t Avance [0, 1].
   * @returns Valor mezclado.
   */
  private static mix(from: number, to: number, t: number): number {
    return from + (to - from) * t;
  }
}
