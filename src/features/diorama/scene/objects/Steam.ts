import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  Vector2,
  type IUniform,
  type WebGLRenderer,
} from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import fragmentShader from '../shaders/steam.frag.glsl?raw';
import vertexShader from '../shaders/steam.vert.glsl?raw';
import type { SteamOptions } from './SteamOptions';

/**
 * Columna de vapor (ramen, ollas): volutas suaves que suben, se abren, crecen y se desvanecen.
 * Todo el movimiento se calcula en GPU; la CPU solo avanza el tiempo.
 */
export class Steam extends SceneObject implements Updatable {
  private static readonly COLOR = 0xe6e0f0;

  private readonly time: IUniform<number> = { value: 0 };
  private readonly viewport: IUniform<number> = { value: 1 };
  private readonly buffer = new Vector2();

  /**
   * Crea el vapor.
   *
   * @param options Origen, cantidad y forma de la columna.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly options: SteamOptions,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    this.time.value = elapsed;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const seeds = new Float32Array(this.options.count);
    seeds.forEach((_seed, index) => {
      seeds[index] = this.random.next();
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.options.count * 3), 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    const points = new Points(geometry, this.material());
    points.frustumCulled = false;
    points.renderOrder = 3;
    points.onBeforeRender = (renderer: WebGLRenderer): void => {
      this.viewport.value = renderer.getDrawingBufferSize(this.buffer).y;
    };
    this.add(points, this.options.origin);
  }

  /**
   * Material transparente de las volutas.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    const { speed, height, spread, size, opacity } = this.options;
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: this.time,
        uViewport: this.viewport,
        uSpeed: { value: speed },
        uHeight: { value: height },
        uSpread: { value: spread },
        uSize: { value: size },
        uOpacity: { value: opacity },
        uColor: { value: new Color(Steam.COLOR) },
      },
      transparent: true,
      depthWrite: false,
    });
  }
}
