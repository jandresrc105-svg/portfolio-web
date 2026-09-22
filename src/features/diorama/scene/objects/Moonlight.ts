import { Color, DirectionalLight, FogExp2, HemisphereLight, type Scene } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';

/**
 * Ambiente nocturno: cielo, niebla azulada y luz de luna fría que recorta las siluetas.
 */
export class Moonlight extends SceneObject {
  private static readonly SKY = 0x05060c;
  private static readonly FOG_DENSITY = 0.028;
  private static readonly HEMISPHERE = { sky: 0x3a4a82, ground: 0x0a0a12, intensity: 0.85 };
  private static readonly MOON = { color: 0x7d95ff, intensity: 0.9, x: -9, y: 14, z: -6 };
  private static readonly RIM = { color: 0xff3d8b, intensity: 0.35, x: 8, y: 3, z: -10 };

  /**
   * Crea el ambiente.
   *
   * @param scene Escena a la que se aplica el fondo y la niebla.
   */
  public constructor(private readonly scene: Scene) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.scene.background = new Color(Moonlight.SKY);
    this.scene.fog = new FogExp2(Moonlight.SKY, Moonlight.FOG_DENSITY);
    const { sky, ground, intensity } = Moonlight.HEMISPHERE;
    this.add(new HemisphereLight(sky, ground, intensity));
    const moon = Moonlight.MOON;
    this.add(new DirectionalLight(moon.color, moon.intensity), moon);
    const rim = Moonlight.RIM;
    this.add(new DirectionalLight(rim.color, rim.intensity), rim);
  }
}
