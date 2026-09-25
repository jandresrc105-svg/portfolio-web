import type { BufferGeometry } from 'three';
import { ToolId } from '../../models/ToolId';
import { PliersTool } from './PliersTool';
import { WallTool } from './WallTool';

/**
 * Alicate de corte diagonal: mordazas cortas y anchas que terminan en una punta roma, con el filo en el borde
 * que cierra, y mangos rojos. Corta al ras las patas sobrantes después de soldar.
 */
export class DiagonalCutter extends PliersTool {
  private static readonly SPEC = {
    spread: 0.2,
    handle: { length: 0.118, radius: 0.0085 },
    grip: 0.092,
    jaw: { length: 0.036, width: 0.016 },
    opening: 0.28,
  };
  private static readonly JAW = [
    { x: 0, y: -0.008 },
    { x: 0, y: 0.036 },
    { x: -0.006, y: 0.034 },
    { x: -0.013, y: 0.026 },
    { x: -0.017, y: 0.012 },
    { x: -0.015, y: -0.004 },
  ];

  /**
   * Crea el alicate.
   */
  public constructor() {
    super(ToolId.Cutter, DiagonalCutter.SPEC, WallTool.PALETTE.redGrip);
  }

  /**
   * @inheritdoc
   */
  protected jaw(depth: number): BufferGeometry {
    return WallTool.SHAPES.plate(DiagonalCutter.JAW, depth);
  }
}
