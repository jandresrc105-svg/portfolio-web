import { Mesh, MeshStandardMaterial, Shape, ShapeGeometry, type BufferGeometry, type Camera } from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';

/**
 * Charcos que reflejan el neón y las linternas.
 * En calidad alta son espejos planares reales (una sola pasada extra para todos); en baja, material muy pulido.
 */
export class Puddles extends SceneObject {
  private static readonly PUDDLES = [
    { x: 1.2, z: 2.6, width: 1.9, depth: 0.9 },
    { x: -1.3, z: 3.3, width: 1.4, depth: 0.7 },
    { x: 2.7, z: 2, width: 0.9, depth: 0.5 },
    { x: -0.2, z: 4.3, width: 1.1, depth: 0.45 },
    { x: 3.3, z: 3.6, width: 0.8, depth: 0.55 },
  ];
  private static readonly OUTLINE_POINTS = 18;
  private static readonly WOBBLE = 0.18;
  private static readonly HEIGHT = 0.004;
  private static readonly REFLECTION = { color: 0x8a90a6, resolution: 0.4, clipBias: 0.003 };
  private static readonly FALLBACK = { color: 0x0a0b10, roughness: 0.04, metalness: 0.9 };

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
  protected override build(): void {
    const geometry = this.geometry();
    this.surface = this.reflections ? Puddles.mirror(geometry) : Puddles.polished(geometry);
    this.surface.rotation.x = -Math.PI / 2;
    this.add(this.surface, { x: 0, y: Puddles.HEIGHT, z: 0 });
  }

  /**
   * Une todos los contornos en una sola geometría, para que el reflejo se calcule una sola vez.
   *
   * @returns Geometría combinada en el plano XY.
   */
  private geometry(): BufferGeometry {
    const shapes = Puddles.PUDDLES.map((puddle) => new ShapeGeometry(this.outline(puddle)));
    const merged = mergeGeometries(shapes);
    shapes.forEach((shape) => {
      shape.dispose();
    });
    return merged;
  }

  /**
   * Contorno orgánico de un charco (elipse deformada).
   *
   * @param puddle Centro y tamaño.
   * @param puddle.x Centro x.
   * @param puddle.z Centro z.
   * @param puddle.width Ancho.
   * @param puddle.depth Profundidad.
   * @returns Forma del charco.
   */
  private outline(puddle: { x: number; z: number; width: number; depth: number }): Shape {
    const shape = new Shape();
    for (let index = 0; index <= Puddles.OUTLINE_POINTS; index += 1) {
      const angle = (index / Puddles.OUTLINE_POINTS) * Math.PI * 2;
      const wobble =
        1 + (index === Puddles.OUTLINE_POINTS ? 0 : this.random.range(-Puddles.WOBBLE, Puddles.WOBBLE));
      const x = puddle.x + (Math.cos(angle) * puddle.width * wobble) / 2;
      const y = -puddle.z - (Math.sin(angle) * puddle.depth * wobble) / 2;
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    }
    return shape;
  }

  /**
   * Espejo planar tintado.
   *
   * @param geometry Geometría de los charcos.
   * @returns Malla reflectante.
   */
  private static mirror(geometry: BufferGeometry): Reflector {
    const { color, resolution, clipBias } = Puddles.REFLECTION;
    return new Reflector(geometry, {
      color,
      clipBias,
      textureWidth: window.innerWidth * resolution * window.devicePixelRatio,
      textureHeight: window.innerHeight * resolution * window.devicePixelRatio,
    });
  }

  /**
   * Material muy pulido para dispositivos modestos.
   *
   * @param geometry Geometría de los charcos.
   * @returns Malla brillante.
   */
  private static polished(geometry: BufferGeometry): Mesh {
    return new Mesh(geometry, new MeshStandardMaterial(Puddles.FALLBACK));
  }
}
