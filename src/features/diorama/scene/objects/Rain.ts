import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  ShaderMaterial,
} from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import fragmentShader from '../shaders/rain.frag.glsl?raw';
import vertexShader from '../shaders/rain.vert.glsl?raw';

/**
 * Lluvia animada completamente en GPU: cada gota es un segmento cuyo desplazamiento calcula el vertex shader.
 * La CPU solo actualiza un uniform de tiempo por frame, sin importar cuántas gotas haya.
 */
export class Rain extends SceneObject implements Updatable {
  private static readonly AREA = { radius: 8.5, height: 14, bottom: -3 };
  private static readonly DROP = { length: 0.3, speed: 11, slant: 0.05 };
  private static readonly COLOR = 0x9fb3ff;
  private static readonly OPACITY = 0.11;
  private static readonly VERTICES_PER_DROP = 2;

  private readonly time = { value: 0 };

  /**
   * Crea la lluvia.
   *
   * @param drops Número de gotas.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly drops: number,
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
    const rain = new LineSegments(this.geometry(), this.material());
    rain.frustumCulled = false;
    this.add(rain);
  }

  /**
   * Material con los parámetros de caída como uniforms.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms(),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }

  /**
   * Parámetros de caída que recibe el shader.
   *
   * @returns Uniforms del material.
   */
  private uniforms(): Record<string, { value: unknown }> {
    const { length, speed, slant } = Rain.DROP;
    const { height, bottom } = Rain.AREA;
    return {
      uTime: this.time,
      uSpeed: { value: speed },
      uHeight: { value: height },
      uBottom: { value: bottom },
      uLength: { value: length },
      uSlant: { value: slant },
      uColor: { value: new Color(Rain.COLOR) },
      uOpacity: { value: Rain.OPACITY },
    };
  }

  /**
   * Posiciones aleatorias dentro de un cilindro; ambos extremos de una gota comparten semilla.
   *
   * @returns Geometría de segmentos.
   */
  private geometry(): BufferGeometry {
    const vertices = this.drops * Rain.VERTICES_PER_DROP;
    const buffers = {
      positions: new Float32Array(vertices * 3),
      seeds: new Float32Array(vertices),
      tails: new Float32Array(vertices),
    };
    for (let drop = 0; drop < this.drops; drop += 1) {
      this.placeDrop(drop, buffers);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(buffers.seeds, 1));
    geometry.setAttribute('aTail', new BufferAttribute(buffers.tails, 1));
    return geometry;
  }

  /**
   * Escribe los dos vértices de una gota en los buffers.
   *
   * @param drop Índice de la gota.
   * @param buffers Buffers de posición, semilla y extremo.
   * @param buffers.positions Posiciones xyz.
   * @param buffers.seeds Altura inicial de cada vértice.
   * @param buffers.tails 0 = cabeza, 1 = cola.
   */
  private placeDrop(
    drop: number,
    buffers: { positions: Float32Array; seeds: Float32Array; tails: Float32Array },
  ): void {
    const angle = this.random.range(0, Math.PI * 2);
    const radius = Math.sqrt(this.random.next()) * Rain.AREA.radius;
    const seed = this.random.range(0, Rain.AREA.height);
    [0, 1].forEach((tail) => {
      const vertex = drop * Rain.VERTICES_PER_DROP + tail;
      buffers.positions.set([Math.cos(angle) * radius, 0, Math.sin(angle) * radius], vertex * 3);
      buffers.seeds[vertex] = seed;
      buffers.tails[vertex] = tail;
    });
  }
}
