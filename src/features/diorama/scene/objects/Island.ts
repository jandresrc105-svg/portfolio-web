import { BoxGeometry, ExtrudeGeometry, Mesh, Shape, Vector2 } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Isla flotante: un trozo de calle arrancado del suelo, con la parte inferior rocosa y afilada. Hacia la
 * izquierda se ensancha para darle espacio al taller de electrónica.
 */
export class Island extends SceneObject {
  private static readonly RADIUS = 6.2;
  private static readonly EDGE_POINTS = 26;
  private static readonly EDGE_JITTER = 0.9;
  private static readonly DEPTH = 3.2;
  private static readonly STEPS = 7;
  private static readonly TAPER = 0.62;
  private static readonly ROCK_JITTER = 0.55;
  private static readonly WIDTH_JITTER = 0.3;
  private static readonly HASH = { x: 12.9898, y: 37.719, z: 78.233, scale: 43758.5453 };
  private static readonly ANNEX = { angle: 2.8, amount: 0.62, width: 0.42 };
  private static readonly SIDEWALK = { width: 5.6, height: 0.1, depth: 4.4, x: 0, y: 0.05, z: -0.1 };

  /**
   * Crea la isla.
   *
   * @param materials Materiales compartidos.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const ground = this.add(new Mesh(this.geometry(), [this.materials.asphalt, this.materials.rock]));
    ground.receiveShadow = true;
    const { width, height, depth, ...position } = Island.SIDEWALK;
    this.add(new Mesh(new BoxGeometry(width, height, depth), this.materials.concrete), position);
  }

  /**
   * Extruye el contorno irregular hacia abajo y lo deforma para que parezca roca fracturada.
   *
   * @returns Geometría de la isla con grupos [superficie, roca].
   */
  private geometry(): ExtrudeGeometry {
    const geometry = new ExtrudeGeometry(this.outline(), {
      depth: Island.DEPTH,
      steps: Island.STEPS,
      bevelEnabled: false,
    });
    geometry.rotateX(Math.PI / 2);
    this.sculpt(geometry);
    geometry.computeVertexNormals();
    return geometry;
  }

  /**
   * Contorno irregular de la isla.
   *
   * @returns Forma 2D cerrada.
   */
  private outline(): Shape {
    const points: Vector2[] = [];
    for (let index = 0; index < Island.EDGE_POINTS; index += 1) {
      const angle = (index / Island.EDGE_POINTS) * Math.PI * 2;
      const jitter = this.random.range(-Island.EDGE_JITTER, Island.EDGE_JITTER * 0.5);
      const radius = (Island.RADIUS + jitter) * Island.annex(angle);
      points.push(new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
    }
    return new Shape(points);
  }

  /**
   * Estrecha la base y desplaza sus vértices para un fondo rocoso y puntiagudo.
   *
   * @param geometry Geometría extruida (superficie en y = 0, base en y = -DEPTH).
   */
  private sculpt(geometry: ExtrudeGeometry): void {
    const position = geometry.getAttribute('position');
    for (let index = 0; index < position.count; index += 1) {
      const [x, y, z] = [position.getX(index), position.getY(index), position.getZ(index)];
      const depth = -y / Island.DEPTH;
      if (depth <= 0) {
        continue;
      }
      const noise = Island.hash(x, y, z);
      const taper =
        1 - Island.TAPER * depth ** 2 + (noise - 0.5) * Island.ROCK_JITTER * depth * Island.WIDTH_JITTER;
      position.setXYZ(index, x * taper, y - noise * Island.ROCK_JITTER * depth, z * taper);
    }
  }

  /**
   * Ruido determinista por posición: vértices coincidentes reciben el mismo valor y la malla no se agrieta.
   *
   * @param x Coordenada x.
   * @param y Coordenada y.
   * @param z Coordenada z.
   * @returns Valor en [0, 1).
   */
  private static hash(x: number, y: number, z: number): number {
    const value = Math.sin(x * Island.HASH.x + y * Island.HASH.y + z * Island.HASH.z) * Island.HASH.scale;
    return value - Math.floor(value);
  }

  /**
   * Ensanche de la isla hacia la izquierda, donde está el taller de electrónica: un lóbulo suave que crece
   * alrededor de un ángulo, así el resto del contorno queda igual.
   *
   * @param angle Ángulo del punto del contorno.
   * @returns Factor que multiplica el radio (1 = sin cambio).
   */
  private static annex(angle: number): number {
    const { angle: center, amount, width } = Island.ANNEX;
    const offset = Math.atan2(Math.sin(angle - center), Math.cos(angle - center)) / width;
    return 1 + amount * Math.exp(-(offset * offset));
  }
}
