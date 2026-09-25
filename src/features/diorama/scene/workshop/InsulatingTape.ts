import { BoxGeometry, LatheGeometry, Vector2 } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { ToolId } from '../../models/ToolId';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolOutline } from '../../models/ToolOutline';
import { WallTool } from './WallTool';

/**
 * Cinta aislante: rollo de vinilo negro brillante sobre su núcleo de cartón, con la punta despegada. Cuelga
 * por el agujero del núcleo. Al inspeccionarla gira sobre su eje vertical y se ve que es un anillo.
 */
export class InsulatingTape extends WallTool {
  private static readonly ROLL = { inner: 0.0165, outer: 0.029, width: 0.019 };
  private static readonly CORE = { inset: 0.0004, extra: 0.0008 };
  private static readonly FLAP = { width: 0.013, thickness: 0.0009, x: 0.02, y: -0.0225, angle: 0.62 };
  private static readonly HOOK = [{ x: 0, y: 0.0115 }];

  /**
   * Crea la cinta.
   */
  public constructor() {
    super(ToolId.Tape);
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    return InsulatingTape.HOOK;
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    const size = InsulatingTape.ROLL.outer * 2;
    return [{ x: 0, y: 0, width: size, height: size, round: 0.5 }];
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    const { inner, outer, width } = InsulatingTape.ROLL;
    const half = width / 2;
    const profile = [
      new Vector2(inner, -half),
      new Vector2(outer, -half),
      new Vector2(outer, half),
      new Vector2(inner, half),
      new Vector2(inner, -half),
    ];
    const palette = WallTool.PALETTE;
    this.part(new LatheGeometry(profile, GeometryDetail.Smooth).rotateX(Math.PI / 2), palette.vinyl);
    const { inset, extra } = InsulatingTape.CORE;
    const core = WallTool.SHAPES.tube(inner - inset, width + extra);
    this.part(core, palette.cardboard);
    this.buildFlap();
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    const size = InsulatingTape.ROLL.outer * 2;
    return { x: 0, y: 0, width: size, height: size };
  }

  /**
   * Punta de la cinta despegada del rollo.
   */
  private buildFlap(): void {
    const { width: flap, thickness, x, y, angle } = InsulatingTape.FLAP;
    const tab = this.part(
      new BoxGeometry(flap, thickness, InsulatingTape.ROLL.width),
      WallTool.PALETTE.vinyl,
    );
    tab.position.set(x, y, 0);
    tab.rotation.z = angle;
  }
}
