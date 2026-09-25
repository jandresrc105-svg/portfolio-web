import { BoxGeometry, Group, type Object3D } from 'three';
import { ToolId } from '../../models/ToolId';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolOutline } from '../../models/ToolOutline';
import type { ToolWallState } from '../../models/ToolWallState';
import { WallTool } from './WallTool';

/**
 * Pinza de electrónica: dos hojas de acero soldadas arriba que se abren en V y terminan en puntas finas, con
 * recubrimiento antiestático (ESD) azul donde se toman. Cuelga de su cabeza. Al inspeccionarla, la apertura
 * aprieta las hojas hasta que las puntas se tocan.
 */
export class Tweezers extends WallTool {
  private static readonly LEG = [
    { x: 0, y: 0.004 },
    { x: 0, y: -0.126 },
    { x: 0.0007, y: -0.126 },
    { x: 0.0024, y: -0.1 },
    { x: 0.0058, y: -0.03 },
    { x: 0.0064, y: 0.004 },
  ];
  private static readonly COAT = [
    { x: -0.0003, y: -0.012 },
    { x: -0.0003, y: -0.074 },
    { x: 0.0052, y: -0.074 },
    { x: 0.0065, y: -0.012 },
  ];
  private static readonly DEPTH = { leg: 0.0012, coat: 0.0024 };
  private static readonly HEAD = { width: 0.0135, height: 0.011, depth: 0.004, y: 0.0005 };
  private static readonly REST = 0.036;
  private static readonly HOOK = [{ x: 0, y: 0.006 }];
  private static readonly SHADOW = { y: -0.06, width: 0.022, height: 0.136, round: 0.3 };

  private readonly legs = [new Group(), new Group()];

  /**
   * Crea la pinza.
   */
  public constructor() {
    super(ToolId.Tweezers);
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    return Tweezers.HOOK;
  }

  /**
   * @inheritdoc
   */
  public override pose(state: ToolWallState): void {
    this.bend(Tweezers.REST * (1 - state.open));
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    const { y, width, height, round } = Tweezers.SHADOW;
    return [{ x: 0, y, width, height, round }];
  }

  /**
   * @inheritdoc
   */
  protected override moving(): Object3D[] {
    return [...this.legs];
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    const palette = WallTool.PALETTE;
    this.legs.forEach((leg, index) => {
      leg.scale.x = index === 0 ? 1 : -1;
      this.part(WallTool.SHAPES.plate(Tweezers.LEG, Tweezers.DEPTH.leg), palette.steel, leg);
      this.part(WallTool.SHAPES.plate(Tweezers.COAT, Tweezers.DEPTH.coat), palette.esdBlue, leg);
      this.body.add(leg);
    });
    const { width, height, depth, y } = Tweezers.HEAD;
    this.part(new BoxGeometry(width, height, depth), palette.steel).position.y = y;
    this.bend(Tweezers.REST);
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    const { y, width, height } = Tweezers.SHADOW;
    return { x: 0, y, width, height };
  }

  /**
   * Abre las hojas.
   *
   * @param angle Giro de cada hoja hacia afuera.
   */
  private bend(angle: number): void {
    this.legs.forEach((leg, index) => {
      leg.rotation.z = (index === 0 ? 1 : -1) * angle;
    });
  }
}
