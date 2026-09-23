import { Mesh, TorusGeometry, type BufferGeometry, type Object3D } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { ToolId } from '../../models/ToolId';
import { PliersTool } from './PliersTool';
import { WallTool } from './WallTool';

/**
 * Crimpadora de terminales: cabeza ancha con matrices escalonadas (una por calibre) y mangos largos rojos y
 * negros, con el resorte de trinquete a la vista entre ellos. Cierra terminales Dupont y JST sin soldar.
 */
export class Crimper extends PliersTool {
  private static readonly SPEC = {
    spread: 0.19,
    handle: { length: 0.14, radius: 0.0095 },
    grip: 0.1,
    jaw: { length: 0.05, width: 0.022 },
    opening: 0.16,
  };
  private static readonly DIES = [
    { y: 0.041, radius: 0.0016 },
    { y: 0.032, radius: 0.0021 },
    { y: 0.022, radius: 0.0027 },
  ];
  private static readonly JAW = { bottom: -0.01 };
  private static readonly SPRING = { y: -0.05, radius: 0.0075, tube: 0.0011, arc: 4.71 };

  /**
   * Crea la crimpadora.
   */
  public constructor() {
    super(ToolId.Crimper, Crimper.SPEC, WallTool.PALETTE.redGrip);
  }

  /**
   * @inheritdoc
   */
  protected jaw(depth: number): BufferGeometry {
    const { length, width } = Crimper.SPEC.jaw;
    return WallTool.SHAPES.notched(
      { width, length, bottom: Crimper.JAW.bottom, notches: Crimper.DIES },
      depth,
    );
  }

  /**
   * Resorte del trinquete entre los mangos.
   *
   * @returns Resorte.
   */
  protected override details(): readonly Object3D[] {
    const { y, radius, tube, arc } = Crimper.SPRING;
    const spring = new Mesh(
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Medium, arc),
      this.finish(WallTool.PALETTE.darkSteel),
    );
    spring.position.y = y;
    spring.rotation.z = Math.PI / 2 - arc / 2 - Math.PI;
    return [spring];
  }
}
