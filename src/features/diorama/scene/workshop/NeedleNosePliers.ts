import type { BufferGeometry } from 'three';
import { ToolId } from '../../models/ToolId';
import { PliersTool } from './PliersTool';
import { WallTool } from './WallTool';

/**
 * Pinza de puntas: mordazas largas que se afinan hasta una punta fina, para doblar patas y sujetar piezas en
 * lugares estrechos, con mangos azules.
 */
export class NeedleNosePliers extends PliersTool {
  private static readonly SPEC = {
    spread: 0.17,
    handle: { length: 0.112, radius: 0.0082 },
    grip: 0.088,
    jaw: { length: 0.074, width: 0.013 },
    opening: 0.22,
  };
  private static readonly JAW = [
    { x: 0, y: -0.008 },
    { x: 0, y: 0.074 },
    { x: -0.0018, y: 0.073 },
    { x: -0.005, y: 0.056 },
    { x: -0.009, y: 0.03 },
    { x: -0.013, y: 0.012 },
    { x: -0.014, y: -0.004 },
  ];

  /**
   * Crea la pinza.
   */
  public constructor() {
    super(ToolId.NeedleNose, NeedleNosePliers.SPEC, WallTool.PALETTE.blueGrip);
  }

  /**
   * @inheritdoc
   */
  protected jaw(depth: number): BufferGeometry {
    return WallTool.SHAPES.plate(NeedleNosePliers.JAW, depth);
  }
}
