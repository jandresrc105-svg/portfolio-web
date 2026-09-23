import {
  CatmullRomCurve3,
  CylinderGeometry,
  Mesh,
  TubeGeometry,
  Vector3,
  type Material,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Fabrica las piezas alargadas del banco (patrón Factory): cables flexibles que pasan por varios puntos y
 * varillas rectas entre dos puntos.
 */
export class BenchCable {
  private static readonly UP = new Vector3(0, 1, 0);

  /**
   * Cable suave que pasa por los puntos dados.
   *
   * @param points Puntos de paso, de un extremo al otro.
   * @param radius Radio del cable.
   * @param material Material.
   * @returns Malla del cable.
   */
  public curve(points: readonly Vector3Like[], radius: number, material: Material): Mesh {
    const curve = new CatmullRomCurve3(points.map((point) => new Vector3().copy(point)));
    return new Mesh(
      new TubeGeometry(curve, GeometryDetail.Curve, radius, GeometryDetail.Wire, false),
      material,
    );
  }

  /**
   * Varilla recta entre dos puntos.
   *
   * @param from Extremo inicial.
   * @param to Extremo final.
   * @param radius Radio.
   * @param material Material.
   * @returns Malla de la varilla.
   */
  public rod(from: Vector3Like, to: Vector3Like, radius: number, material: Material): Mesh {
    const start = new Vector3().copy(from);
    const end = new Vector3().copy(to);
    const rod = new Mesh(
      new CylinderGeometry(radius, radius, start.distanceTo(end), GeometryDetail.Low),
      material,
    );
    rod.position
      .copy(start)
      .add(end)
      .multiplyScalar(1 / 2);
    rod.quaternion.setFromUnitVectors(BenchCable.UP, end.sub(start).normalize());
    return rod;
  }
}
