import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Mesh,
  ShaderMaterial,
  type Camera,
  type IUniform,
} from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import fragmentShader from '../shaders/puddle.frag.glsl?raw';
import vertexShader from '../shaders/puddle.vert.glsl?raw';

/**
 * Charcos de lluvia con bordes orgánicos suaves, ondas de gotas animadas y efecto fresnel.
 * En calidad alta son espejos planares reales (una sola pasada extra para todos, sin MSAA) cuyo reflejo
 * se deforma con las ondas; en calidad baja el mismo shader refleja solo el color del cielo.
 */
export class Puddles extends SceneObject implements Updatable {
  private static readonly PUDDLES = [
    { x: 1.2, z: 2.75, width: 2.3, depth: 1.1 },
    { x: -1.4, z: 3.3, width: 1.7, depth: 0.85 },
    { x: 2.9, z: 1.95, width: 1.1, depth: 0.6 },
    { x: -0.2, z: 4.4, width: 1.4, depth: 0.55 },
    { x: 3.4, z: 3.7, width: 1, depth: 0.7 },
    { x: -3.1, z: 3.1, width: 0.9, depth: 0.5 },
  ];
  private static readonly QUAD_CORNERS = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 1 },
  ];
  private static readonly QUAD_INDICES = [0, 1, 2, 0, 2, 3];
  private static readonly QUAD_MARGIN = 1.3;
  private static readonly HEIGHT = 0.004;
  private static readonly REFLECTION = { color: 0xb4b9d6, resolution: 0.4, clipBias: 0.003 };
  private static readonly SURFACE = { base: 0x040409, sky: 0x1a1830, skyFallback: 0x2a2548, opacity: 0.94 };

  private readonly time: IUniform<number> = { value: 0 };
  private surface: Mesh | Reflector | null = null;

  /**
   * Crea los charcos.
   *
   * @param reflections Usar reflejos planares reales.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly reflections: boolean,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * Limita el reflejo a una sola capa (los objetos luminosos). En un charco de noche solo se distinguen
   * las luces, y reflejar la escena completa costaba tanto como dibujarla dos veces.
   *
   * @param camera Cámara principal, de la que el reflector clona su cámara de reflejo.
   * @param layer Única capa que se refleja.
   */
  public reflectOnly(camera: Camera, layer: number): void {
    if (this.surface instanceof Reflector) {
      this.surface.getReflectionCamera(camera).layers.set(layer);
    }
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
    const geometry = this.geometry();
    this.surface = this.reflections ? this.mirror(geometry) : this.matte(geometry);
    this.surface.rotation.x = -Math.PI / 2;
    this.surface.renderOrder = 1;
    this.add(this.surface, { x: 0, y: Puddles.HEIGHT, z: 0 });
  }

  /**
   * Un rectángulo por charco en una sola geometría; la forma real la recorta el shader con ruido.
   *
   * @returns Geometría en el plano XY con coordenadas locales y semilla por charco.
   */
  private geometry(): BufferGeometry {
    const corners = Puddles.QUAD_CORNERS;
    const count = Puddles.PUDDLES.length * corners.length;
    const buffers = {
      positions: new Float32Array(count * 3),
      locals: new Float32Array(count * 2),
      seeds: new Float32Array(count),
    };
    const indices: number[] = [];
    Puddles.PUDDLES.forEach((puddle, index) => {
      this.writeQuad(puddle, index, buffers);
      indices.push(...Puddles.QUAD_INDICES.map((corner) => corner + index * corners.length));
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(buffers.positions, 3));
    geometry.setAttribute('aLocal', new BufferAttribute(buffers.locals, 2));
    geometry.setAttribute('aSeed', new BufferAttribute(buffers.seeds, 1));
    geometry.setIndex(indices);
    return geometry;
  }

  /**
   * Escribe las cuatro esquinas de un charco.
   *
   * @param puddle Centro y tamaño.
   * @param index Índice del charco.
   * @param buffers Buffers de posición, coordenada local y semilla.
   * @param buffers.positions Posiciones xyz.
   * @param buffers.locals Coordenadas locales [-1, 1].
   * @param buffers.seeds Semilla de la forma.
   */
  private writeQuad(
    puddle: (typeof Puddles.PUDDLES)[number],
    index: number,
    buffers: { positions: Float32Array; locals: Float32Array; seeds: Float32Array },
  ): void {
    const seed = this.random.next();
    const margin = Puddles.QUAD_MARGIN / 2;
    Puddles.QUAD_CORNERS.forEach((corner, offset) => {
      const vertex = index * Puddles.QUAD_CORNERS.length + offset;
      const x = puddle.x + corner.x * puddle.width * margin;
      const y = -puddle.z + corner.y * puddle.depth * margin;
      buffers.positions.set([x, y, 0], vertex * 3);
      buffers.locals.set([corner.x, corner.y], vertex * 2);
      buffers.seeds[vertex] = seed;
    });
  }

  /**
   * Uniforms comunes a ambas versiones.
   *
   * @param sky Color del cielo reflejado.
   * @returns Uniforms del shader.
   */
  private uniforms(sky: number): Record<string, IUniform> {
    const { base, opacity } = Puddles.SURFACE;
    return {
      color: { value: new Color(Puddles.REFLECTION.color) },
      tDiffuse: { value: null },
      textureMatrix: { value: new Matrix4() },
      uTime: this.time,
      uBase: { value: new Color(base) },
      uSky: { value: new Color(sky) },
      uOpacity: { value: opacity },
    };
  }

  /**
   * Espejo planar con el shader de charco. El reflector clona los uniforms, por eso se vuelve a enlazar el tiempo.
   *
   * @param geometry Geometría de los charcos.
   * @returns Malla reflectante.
   */
  private mirror(geometry: BufferGeometry): Reflector {
    const { resolution, clipBias } = Puddles.REFLECTION;
    const reflector = new Reflector(geometry, {
      clipBias,
      multisample: 0,
      textureWidth: window.innerWidth * resolution * window.devicePixelRatio,
      textureHeight: window.innerHeight * resolution * window.devicePixelRatio,
      shader: {
        name: 'PuddleShader',
        uniforms: this.uniforms(Puddles.SURFACE.sky),
        vertexShader,
        fragmentShader: `#define USE_REFLECTION\n${fragmentShader}`,
      },
    });
    const material = reflector.material as ShaderMaterial;
    material.uniforms.uTime = this.time;
    material.transparent = true;
    material.depthWrite = false;
    return reflector;
  }

  /**
   * Versión sin espejo para dispositivos modestos: mismas ondas y bordes, reflejando solo el cielo.
   *
   * @param geometry Geometría de los charcos.
   * @returns Malla del charco.
   */
  private matte(geometry: BufferGeometry): Mesh {
    const material = new ShaderMaterial({
      uniforms: this.uniforms(Puddles.SURFACE.skyFallback),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
    return new Mesh(geometry, material);
  }
}
