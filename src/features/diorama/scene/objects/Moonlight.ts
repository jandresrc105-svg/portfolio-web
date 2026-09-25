import { Color, DirectionalLight, FogExp2, HemisphereLight, type Scene } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';

/**
 * Ambiente nocturno: fondo oscuro, niebla opcional del color del horizonte, luz de cielo y luna fría que
 * recorta las siluetas.
 * La luna es pública porque la tormenta la refuerza durante los relámpagos.
 */
export class Moonlight extends SceneObject {
  private static readonly HAZE = 0x0b0919;
  private static readonly FOG_DENSITY = 0.018;
  private static readonly HEMISPHERE = { sky: 0x3a4a82, ground: 0x0a0a12, intensity: 0.6 };
  private static readonly MOON = { color: 0x7d95ff, intensity: 0.9, x: -9, y: 14, z: -6 };
  private static readonly RIM = { color: 0xff3d8b, intensity: 0.35, x: 8, y: 3, z: -10 };

  public readonly moon = new DirectionalLight(Moonlight.MOON.color, Moonlight.MOON.intensity);

  /**
   * Crea el ambiente.
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
  protected override build(): void {
    this.scene.background = new Color(Moonlight.HAZE);
    this.scene.fog = this.fog ? new FogExp2(Moonlight.HAZE, Moonlight.FOG_DENSITY) : null;
    const { sky, ground, intensity } = Moonlight.HEMISPHERE;
    this.add(new HemisphereLight(sky, ground, intensity));
    this.add(this.moon, Moonlight.MOON);
    const rim = Moonlight.RIM;
    this.add(new DirectionalLight(rim.color, rim.intensity), rim);
  }
}
