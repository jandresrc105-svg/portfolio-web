import { CatmullRomCurve3, Mesh, MeshBasicMaterial, Shape, TubeGeometry, Vector3 } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Powerable } from '../../models/Powerable';
import type { NeonTubeOptions } from './NeonTubeOptions';

/**
 * Tubo de neón cerrado con forma de rectángulo redondeado, para enmarcar letreros y vitrinas.
 * Su color supera el umbral del bloom, así que el halo lo pone el post-procesado sin luces extra.
 */
export class NeonTube implements Powerable {
  private static readonly OFF_GLOW = 0.05;
  private static readonly CORNER_POINTS = 6;

  public readonly mesh: Mesh<TubeGeometry, MeshBasicMaterial>;

  /**
   * Crea el tubo.
   *
   * @param options Medidas y color.
   */
  public constructor(private readonly options: NeonTubeOptions) {
    const curve = new CatmullRomCurve3(NeonTube.outline(options), true, 'centripetal');
    const geometry = new TubeGeometry(
      curve,
      GeometryDetail.Ring * 2,
      options.thickness,
      GeometryDetail.Thin,
      true,
    );
    this.mesh = new Mesh(geometry, new MeshBasicMaterial());
    this.setPower(0);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    const glow = Math.max(level * this.options.glow, NeonTube.OFF_GLOW);
    this.mesh.material.color.set(this.options.color).multiplyScalar(glow);
  }

  /**
   * Puntos del contorno, centrado en el origen sobre el plano XY.
   *
   * @param options Medidas del rectángulo.
   * @returns Puntos del contorno.
   */
  private static outline(options: NeonTubeOptions): Vector3[] {
    const { width, height, corner } = options;
    const x = width / 2 - corner;
    const y = height / 2 - corner;
    const quarter = Math.PI / 2;
    const shape = new Shape();
    shape.absarc(x, y, corner, 0, quarter, false);
    shape.absarc(-x, y, corner, quarter, quarter * 2, false);
    shape.absarc(-x, -y, corner, quarter * 2, quarter * 3, false);
    shape.absarc(x, -y, corner, quarter * 3, Math.PI * 2, false);
    return shape.getPoints(NeonTube.CORNER_POINTS).map((point) => new Vector3(point.x, point.y, 0));
  }
}
