import { CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import { ToolId } from '../../models/ToolId';
import type { ToolWallState } from '../../models/ToolWallState';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopLayout } from './WorkshopLayout';
import { ToolRackFactory } from './ToolRackFactory';
import { ToolShadowBoard } from './ToolShadowBoard';
import type { WallTool } from './WallTool';

/**
 * Pared de herramientas: la mitad izquierda del tablero perforado con el tablero de siluetas, las clavijas
 * y cada herramienta en su gancho. Recibe del equipo cuál está tomada y cómo se inspecciona, y cada
 * herramienta anima su propio vuelo y mecanismo.
 */
export class ToolWallPiece extends SceneObject implements Updatable, Powerable {
  private static readonly ZONE = { x: -0.62, y: 1.84, width: 1.16, height: 0.84 };
  private static readonly SLOTS: Readonly<Record<ToolId, { x: number; y: number }>> = {
    [ToolId.Caliper]: { x: -1.03, y: 2.215 },
    [ToolId.Cutter]: { x: -0.77, y: 2.18 },
    [ToolId.NeedleNose]: { x: -0.6, y: 2.16 },
    [ToolId.Stripper]: { x: -0.43, y: 2.16 },
    [ToolId.Crimper]: { x: -0.25, y: 2.17 },
    [ToolId.Solder]: { x: -1.06, y: 1.84 },
    [ToolId.Tape]: { x: -0.91, y: 1.84 },
    [ToolId.DesolderPump]: { x: -0.76, y: 1.93 },
    [ToolId.FlatDriver]: { x: -0.58, y: 1.78 },
    [ToolId.CrossDriver]: { x: -0.46, y: 1.78 },
    [ToolId.PrecisionDriver]: { x: -0.35, y: 1.8 },
    [ToolId.Tweezers]: { x: -0.21, y: 1.92 },
  };
  private static readonly DEPTH = { tool: 0.022, board: 0.0015 };
  private static readonly HELD = { x: -0.45, pull: 0.6, y: 1.55, z: 0.2 };
  private static readonly PEG = {
    radius: 0.0032,
    length: 0.042,
    color: 0xa7adb3,
    roughness: 0.35,
    metalness: 0.8,
    envMapIntensity: 0.4,
  };

  private readonly layout: WorkshopLayout;
  private readonly board: ToolShadowBoard;
  private readonly tools: readonly WallTool[];

  /**
   * Crea la pared.
   *
   * @param context Materiales, texturas y ubicación del taller.
   */
  public constructor(context: WorkshopContext) {
    super();
    this.layout = context.layout;
    this.board = new ToolShadowBoard(context.textures);
    this.tools = new ToolRackFactory(context.textures).create();
  }

  /**
   * Controles: una zona de clic por herramienta.
   *
   * @returns Controles.
   */
  public controls(): readonly WorkshopControl[] {
    return this.tools.map((tool) => ({ id: tool.id, hitArea: tool.hitArea }));
  }

  /**
   * Toma una herramienta (las demás vuelven a su gancho y a su pose de reposo).
   *
   * @param state Estado de la pared.
   */
  public hold(state: ToolWallState): void {
    const rest: ToolWallState = { held: null, turn: 0, open: 0, reading: 0 };
    this.tools.forEach((tool) => {
      const held = tool.id === state.held;
      tool.setHeld(held);
      tool.pose(held ? state : rest);
    });
  }

  /**
   * Inspecciona la herramienta tomada.
   *
   * @param state Estado de la pared.
   */
  public pose(state: ToolWallState): void {
    this.tools.find((tool) => tool.id === state.held)?.pose(state);
  }

  /**
   * Resalta la herramienta señalada.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.tools.forEach((tool) => {
      tool.highlight(tool.id === id);
    });
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.tools.forEach((tool) => {
      tool.update(delta, elapsed);
    });
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.tools.forEach((tool) => {
      tool.setPower(level);
    });
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    this.tools.forEach((tool) => {
      tool.dispose();
    });
    super.dispose();
  }

  /**
   * @inheritdoc
   */
  protected build(): void {
    const wall = this.layout.pegboardZ();
    const toolZ = wall + ToolWallPiece.DEPTH.tool;
    this.tools.forEach((tool) => {
      const slot = ToolWallPiece.SLOTS[tool.id];
      const { x, pull, y, z } = ToolWallPiece.HELD;
      this.add(tool.build());
      tool.place(new Vector3(slot.x, slot.y, toolZ), new Vector3(slot.x + (x - slot.x) * pull, y, z));
    });
    this.buildBoard(wall);
    this.buildPegs(wall);
    this.layout.place(this.root);
  }

  /**
   * Tablero de siluetas, apenas delante del tablero perforado.
   *
   * @param wall Cara del tablero perforado.
   */
  private buildBoard(wall: number): void {
    const entries = this.tools.map((tool) => ({ ...ToolWallPiece.SLOTS[tool.id], outline: tool.outline() }));
    const { mesh, texture } = this.board.build(ToolWallPiece.ZONE, entries);
    this.own(texture);
    mesh.position.z = wall + ToolWallPiece.DEPTH.board;
    this.add(mesh);
  }

  /**
   * Clavijas de acero que salen del tablero, una instancia por gancho.
   *
   * @param wall Cara del tablero perforado.
   */
  private buildPegs(wall: number): void {
    const hooks = this.tools.flatMap((tool) => {
      const slot = ToolWallPiece.SLOTS[tool.id];
      return tool.hooks().map((hook) => ({ x: slot.x + hook.x, y: slot.y + hook.y }));
    });
    const { radius, length, ...finish } = ToolWallPiece.PEG;
    const geometry = new CylinderGeometry(radius, radius, length, GeometryDetail.Thin).rotateX(Math.PI / 2);
    const pegs = new InstancedMesh(geometry, new MeshStandardMaterial(finish), hooks.length);
    const turn = new Quaternion();
    const size = new Vector3(1, 1, 1);
    hooks.forEach(({ x, y }, index) => {
      pegs.setMatrixAt(index, new Matrix4().compose(new Vector3(x, y, wall + length / 2), turn, size));
    });
    this.add(pegs);
  }
}
