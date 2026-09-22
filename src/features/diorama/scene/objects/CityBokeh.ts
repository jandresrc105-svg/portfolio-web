import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, PointsMaterial } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Luces de ciudad desenfocadas (bokeh) muy lejos del diorama: dan profundidad y ambiente nocturno.
 */
export class CityBokeh extends SceneObject implements Updatable {
  private static readonly COUNT = 220;
  private static readonly DISTANCE = { min: 38, max: 75 };
  private static readonly HEIGHT = { min: -18, max: 16 };
  private static readonly SIZE = 2.6;
  private static readonly OPACITY = 0.3;
  private static readonly ROTATION_SPEED = 0.004;
  private static readonly PALETTE = [
    { color: 0xff2d78 },
    { color: 0x3fd8ff },
    { color: 0xffb347 },
    { color: 0x9d7bff },
    { color: 0xff6b3d },
    { color: 0x5effc3 },
  ];
  private static readonly BRIGHTNESS = { min: 0.25, max: 1 };

  /**
   * Crea las luces lejanas.
   *
   * @param textures Fábrica de texturas.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    this.root.rotation.y += delta * CityBokeh.ROTATION_SPEED;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const material = new PointsMaterial({
      size: CityBokeh.SIZE,
      map: this.own(this.textures.softDot()),
      vertexColors: true,
      transparent: true,
      opacity: CityBokeh.OPACITY,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    this.add(new Points(this.geometry(), material));
  }

  /**
   * Distribuye las luces en un anillo alrededor de la escena.
   *
   * @returns Geometría con posición y color.
   */
  private geometry(): BufferGeometry {
    const positions = new Float32Array(CityBokeh.COUNT * 3);
    const colors = new Float32Array(CityBokeh.COUNT * 3);
    const color = new Color();
    for (let index = 0; index < CityBokeh.COUNT; index += 1) {
      const angle = this.random.range(0, Math.PI * 2);
      const distance = this.random.range(CityBokeh.DISTANCE.min, CityBokeh.DISTANCE.max);
      const y = this.random.range(CityBokeh.HEIGHT.min, CityBokeh.HEIGHT.max);
      positions.set([Math.cos(angle) * distance, y, Math.sin(angle) * distance], index * 3);
      color.set(this.random.pick(CityBokeh.PALETTE).color);
      color.multiplyScalar(this.random.range(CityBokeh.BRIGHTNESS.min, CityBokeh.BRIGHTNESS.max));
      colors.set([color.r, color.g, color.b], index * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return geometry;
  }
}
