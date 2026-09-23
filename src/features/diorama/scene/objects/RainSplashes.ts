import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  type IUniform,
} from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import fragmentShader from '../shaders/splash.frag.glsl?raw';
import vertexShader from '../shaders/splash.vert.glsl?raw';

/**
 * Salpicaduras de lluvia sobre el asfalto: anillos que se abren y se desvanecen. Todo se anima en GPU
 * (un solo draw call) y cada salpicadura cambia de lugar en cada ciclo para que no se note la repetición.
 * Evita el interior del puesto, que está bajo techo.
 */
export class RainSplashes extends SceneObject implements Updatable {
  private static readonly AREA = { radius: 5.4, height: 0.012 };
  private static readonly SHELTER = { minX: -2.65, maxX: 2.65, minZ: -2.15, maxZ: 1.8 };
  private static readonly SPLASH = { rate: 1.6, size: 0.065, jitter: 0.8, color: 0xaebdff, opacity: 0.3 };
  private static readonly CORNERS = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
  private static readonly INDICES = [0, 2, 1, 0, 3, 2];
  private static readonly MAX_ATTEMPTS = 12;

  private readonly time: IUniform<number> = { value: 0 };

  /**
   * Crea las salpicaduras.
   *
   * @param count Número de salpicaduras simultáneas.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly count: number,
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
    const mesh = new Mesh(this.geometry(), this.material());
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    this.add(mesh, { x: 0, y: RainSplashes.AREA.height, z: 0 });
  }

  /**
   * Material aditivo con los parámetros de la animación.
   *
   * @returns Material de shader.
   */
  private material(): ShaderMaterial {
    const { rate, size, jitter, color, opacity } = RainSplashes.SPLASH;
    return new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: this.time,
        uRate: { value: rate },
        uSize: { value: size },
        uJitter: { value: jitter },
        uColor: { value: new Color(color) },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }

  /**
   * Un cuadrado plano por salpicadura; el shader lo escala y dibuja los anillos.
   *
   * @returns Geometría de todas las salpicaduras.
   */
  private geometry(): BufferGeometry {
    const vertices = this.count * RainSplashes.CORNERS.length;
    const buffers = {
      positions: new Float32Array(vertices * 3),
      corners: new Float32Array(vertices * 2),
      seeds: new Float32Array(vertices),
    };
    const indices: number[] = [];
    for (let splash = 0; splash < this.count; splash += 1) {
      this.writeSplash(splash, buffers);
      indices.push(...RainSplashes.INDICES.map((corner) => corner + splash * RainSplashes.CORNERS.length));
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('aCorner', new BufferAttribute(buffers.corners, 2));
    geometry.setAttribute('aSeed', new BufferAttribute(buffers.seeds, 1));
    geometry.setIndex(indices);
    return geometry;
  }

  /**
   * Escribe las cuatro esquinas de una salpicadura en los buffers.
   *
   * @param splash Índice de la salpicadura.
   * @param buffers Buffers de posición, esquina y semilla.
   * @param buffers.positions Centro repetido en cada esquina.
   * @param buffers.corners Esquina local [-1, 1].
   * @param buffers.seeds Desfase del ciclo.
   */
  private writeSplash(
    splash: number,
    buffers: { positions: Float32Array; corners: Float32Array; seeds: Float32Array },
  ): void {
    const center = this.openGround();
    const seed = this.random.next();
    RainSplashes.CORNERS.forEach((corner, offset) => {
      const vertex = splash * RainSplashes.CORNERS.length + offset;
      buffers.positions.set([center.x, 0, center.z], vertex * 3);
      buffers.corners.set([corner.x, corner.y], vertex * 2);
      buffers.seeds[vertex] = seed;
    });
  }

  /**
   * Punto aleatorio de la isla que no esté bajo el techo del puesto.
   *
   * @returns Coordenadas x/z.
   */
  private openGround(): { x: number; z: number } {
    let point = this.randomPoint();
    for (
      let attempt = 0;
      attempt < RainSplashes.MAX_ATTEMPTS && RainSplashes.sheltered(point);
      attempt += 1
    ) {
      point = this.randomPoint();
    }
    return point;
  }

  /**
   * Punto uniforme dentro del disco de la isla.
   *
   * @returns Coordenadas x/z.
   */
  private randomPoint(): { x: number; z: number } {
    const angle = this.random.range(0, Math.PI * 2);
    const radius = Math.sqrt(this.random.next()) * RainSplashes.AREA.radius;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
  }

  /**
   * Indica si un punto queda bajo el techo del puesto.
   *
   * @param point Coordenadas x/z.
   * @param point.x Coordenada x.
   * @param point.z Coordenada z.
   * @returns `true` si está bajo techo.
   */
  private static sheltered(point: { x: number; z: number }): boolean {
    const { minX, maxX, minZ, maxZ } = RainSplashes.SHELTER;
    return point.x > minX && point.x < maxX && point.z > minZ && point.z < maxZ;
  }
}
