import { ExtrudeGeometry, Mesh, Shape, Vector2 } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';
import { Island } from './Island';

/**
 * Acera de la manzana: un bloque de concreto con bordillo que cubre todo menos las dos calles (la de adelante y
 * la de la izquierda), con la esquina redondeada donde se cruzan. Donde el rectángulo se saldría de la isla, el
 * contorno se recorta contra su borde, así la acera también parece arrancada con el resto.
 */
export class Sidewalk extends SceneObject {
  public static readonly HEIGHT = 0.1;
  public static readonly CURB = { left: -5, front: 2.1 };

  private static readonly BLOCK = { right: 6, back: -6.5 };
  private static readonly CORNER = { radius: 0.8, segments: 6 };
  private static readonly STEP = 0.3;
  private static readonly EDGE = 0.95;

  /**
   * Crea la acera.
   *
   * @param materials Materiales compartidos.
   */
  public constructor(private readonly materials: MaterialLibrary) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const geometry = new ExtrudeGeometry(new Shape(this.outline()), {
      depth: Sidewalk.HEIGHT,
      bevelEnabled: false,
    });
    geometry.rotateX(-Math.PI / 2);
    const slab = this.add(new Mesh(geometry, this.materials.concrete));
    slab.receiveShadow = true;
  }

  /**
   * Contorno de la manzana (x, -z), densificado y recortado contra el borde de la isla.
   *
   * @returns Puntos del contorno.
   */
  private outline(): Vector2[] {
    const corners = this.corners();
    const points: Vector2[] = [];
    corners.forEach((from, index) => {
      const to = corners[(index + 1) % corners.length] ?? from;
      const count = Math.max(1, Math.ceil(from.distanceTo(to) / Sidewalk.STEP));
      for (let step = 0; step < count; step += 1) {
        points.push(Sidewalk.clamp(from.clone().lerp(to, step / count)));
      }
    });
    return points;
  }

  /**
   * Esquinas del rectángulo de la manzana, con la del cruce redondeada.
   *
   * @returns Vértices en el plano (x, -z).
   */
  private corners(): Vector2[] {
    const { left, front } = Sidewalk.CURB;
    const { right, back } = Sidewalk.BLOCK;
    const { radius, segments } = Sidewalk.CORNER;
    const arc = Array.from({ length: segments + 1 }, (_, index) => {
      const angle = (Math.PI / 2) * (1 + index / segments);
      return new Vector2(
        left + radius + Math.cos(angle) * radius,
        -(front - radius + Math.sin(angle) * radius),
      );
    });
    return [new Vector2(left, -back), new Vector2(right, -back), new Vector2(right, -front), ...arc];
  }

  /**
   * Acerca un punto al centro si queda fuera del borde de la isla.
   *
   * @param point Punto en el plano (x, -z).
   * @returns El mismo punto, recortado.
   */
  private static clamp(point: Vector2): Vector2 {
    const angle = Math.atan2(-point.y, point.x);
    const limit = Island.innerRadius(angle) * Sidewalk.EDGE;
    const radius = point.length();
    return radius > limit ? point.multiplyScalar(limit / radius) : point;
  }
}
