import { BufferAttribute, BufferGeometry, Color, LineSegments, ShaderMaterial, type IUniform } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import fragmentShader from '../shaders/rain.frag.glsl?raw';
import vertexShader from '../shaders/rain.vert.glsl?raw';

/**
 * Goteras que caen del borde del techo: hilos de agua más gruesos y lentos que la lluvia, que brillan
 * con las luces del puesto. Reutiliza el shader de la lluvia (animación completa en GPU).
 */
export class RoofDrips extends SceneObject implements Updatable {
  private static readonly EDGES = [
    { from: -2.45, to: 2.45, z: 1.7 },
    { from: -2.45, to: 2.45, z: -2.1 },
  ];
  private static readonly DRIPS_PER_EDGE = 26;
  private static readonly FALL = { top: 2.62, speed: 5.5, length: 0.14, slant: 0.01 };
  private static readonly COLOR = 0xd7ddff;
  private static readonly OPACITY = 0.32;
  private static readonly VERTICES_PER_DRIP = 2;

  private readonly time: IUniform<number> = { value: 0 };

  /**
   * Crea las goteras.
   *
   * @param random Generador determinista.
   */
  public constructor(private readonly random: SeededRandom) {
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
    const drips = new LineSegments(this.geometry(), this.material());
    drips.frustumCulled = false;
    this.add(drips);
  }

  /**
   * Material del shader de lluvia con los parámetros de las goteras.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    const { top, speed, length, slant } = RoofDrips.FALL;
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: this.time,
        uSpeed: { value: speed },
        uHeight: { value: top },
        uBottom: { value: 0 },
        uLength: { value: length },
        uSlant: { value: slant },
        uColor: { value: new Color(RoofDrips.COLOR) },
        uOpacity: { value: RoofDrips.OPACITY },
      },
      transparent: true,
      depthWrite: false,
    });
  }

  /**
   * Puntos de goteo repartidos a lo largo de los bordes del techo.
   *
   * @returns Geometría de segmentos.
   */
  private geometry(): BufferGeometry {
    const count = RoofDrips.EDGES.length * RoofDrips.DRIPS_PER_EDGE;
    const vertices = count * RoofDrips.VERTICES_PER_DRIP;
    const buffers = {
      positions: new Float32Array(vertices * 3),
      seeds: new Float32Array(vertices),
      tails: new Float32Array(vertices),
    };
    for (let drip = 0; drip < count; drip += 1) {
      this.placeDrip(drip, buffers);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(buffers.seeds, 1));
    geometry.setAttribute('aTail', new BufferAttribute(buffers.tails, 1));
    return geometry;
  }

  /**
   * Escribe los dos vértices de una gotera en los buffers.
   *
   * @param drip Índice de la gotera.
   * @param buffers Buffers de posición, semilla y extremo.
   * @param buffers.positions Posiciones xyz.
   * @param buffers.seeds Altura inicial de cada vértice.
   * @param buffers.tails 0 = cabeza, 1 = cola.
   */
  private placeDrip(
    drip: number,
    buffers: { positions: Float32Array; seeds: Float32Array; tails: Float32Array },
  ): void {
    const edge = RoofDrips.EDGES[Math.floor(drip / RoofDrips.DRIPS_PER_EDGE)] ?? { from: 0, to: 0, z: 0 };
    const x = this.random.range(edge.from, edge.to);
    const seed = this.random.range(0, RoofDrips.FALL.top);
    [0, 1].forEach((tail) => {
      const vertex = drip * RoofDrips.VERTICES_PER_DRIP + tail;
      buffers.positions.set([x, 0, edge.z], vertex * 3);
      buffers.seeds[vertex] = seed;
      buffers.tails[vertex] = tail;
    });
  }
}
