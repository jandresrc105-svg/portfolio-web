import {
  ConeGeometry,
  CylinderGeometry,
  LatheGeometry,
  Vector2,
  type Mesh,
  type MeshStandardMaterialParameters,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { ToolBounds } from '../../models/ToolBounds';
import { ToolId } from '../../models/ToolId';
import type { ToolOutline } from '../../models/ToolOutline';
import { WallTool } from './WallTool';

/**
 * Destornillador colgado con la punta hacia abajo, apoyado por la virola sobre dos clavijas: mango
 * hexagonal torneado de dos colores, virola cromada, caña y punta plana (hoja que se ensancha) o de estrella
 * (pirámide de cuatro aristas). El de precisión lleva además el capuchón giratorio. Al inspeccionarlo gira
 * sobre su caña.
 */
export class Screwdriver extends WallTool {
  private static readonly PROFILE = [
    { r: 0.42, y: 0 },
    { r: 0.86, y: 0.06 },
    { r: 1, y: 0.18 },
    { r: 0.97, y: 0.78 },
    { r: 0.84, y: 0.95 },
    { r: 0.5, y: 1 },
    { r: 0, y: 1 },
  ];
  private static readonly BAND = { radius: 1.04, height: 0.26, y: 0.46 };
  private static readonly FERRULE = { radius: 0.46, height: 0.08 };
  private static readonly SWIVEL = { radius: 0.78, height: 0.07 };
  private static readonly TIP = {
    length: 0.012,
    flare: 1.55,
    flat: 0.3,
    cross: 1.15,
    sides: 4,
    square: 0.7854,
  };
  private static readonly PEG = { gap: 0.004, drop: 0.0035 };
  private static readonly OUTLINE = { handle: 0.3, shaft: 1.6 };
  private static readonly SPECS = {
    [ToolId.FlatDriver]: {
      handle: { radius: 0.0155, length: 0.1 },
      shaft: { radius: 0.003, length: 0.1 },
      cross: false,
      swivel: false,
      grip: WallTool.PALETTE.yellowGrip,
      band: WallTool.PALETTE.blackRubber,
    },
    [ToolId.CrossDriver]: {
      handle: { radius: 0.0155, length: 0.1 },
      shaft: { radius: 0.003, length: 0.09 },
      cross: true,
      swivel: false,
      grip: WallTool.PALETTE.redHandle,
      band: WallTool.PALETTE.blackRubber,
    },
    [ToolId.PrecisionDriver]: {
      handle: { radius: 0.0078, length: 0.08 },
      shaft: { radius: 0.0014, length: 0.05 },
      cross: false,
      swivel: true,
      grip: WallTool.PALETTE.esdBlue,
      band: WallTool.PALETTE.blackRubber,
    },
  };

  private readonly spec: {
    handle: { radius: number; length: number };
    shaft: { radius: number; length: number };
    cross: boolean;
    swivel: boolean;
    grip: MeshStandardMaterialParameters;
    band: MeshStandardMaterialParameters;
  };

  /**
   * Crea el destornillador.
   *
   * @param id Herramienta (plano, de estrella o de precisión).
   */
  public constructor(id: ToolId.FlatDriver | ToolId.CrossDriver | ToolId.PrecisionDriver) {
    super(id);
    this.spec = Screwdriver.SPECS[id];
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    const { gap, drop } = Screwdriver.PEG;
    const x = this.spec.shaft.radius + gap;
    return [
      { x: -x, y: -drop },
      { x, y: -drop },
    ];
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    const { handle, shaft } = this.spec;
    const reach = shaft.length + Screwdriver.TIP.length;
    return [
      {
        x: 0,
        y: handle.length / 2,
        width: handle.radius * 2,
        height: handle.length,
        round: Screwdriver.OUTLINE.handle,
      },
      { x: 0, y: -reach / 2, width: shaft.radius * 2 * Screwdriver.OUTLINE.shaft, height: reach, round: 0.5 },
    ];
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    this.buildHandle();
    const { radius, length } = this.spec.shaft;
    const palette = WallTool.PALETTE;
    this.part(WallTool.SHAPES.rod(radius, length, GeometryDetail.Thin), palette.chrome).position.y =
      -length / 2;
    const tip = this.spec.cross ? this.crossTip() : this.flatTip();
    tip.position.y = -length - Screwdriver.TIP.length / 2;
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    const { handle, shaft } = this.spec;
    const bottom = -shaft.length - Screwdriver.TIP.length;
    return {
      x: 0,
      y: (handle.length + bottom) / 2,
      width: handle.radius * 2,
      height: handle.length - bottom,
    };
  }

  /**
   * Mango torneado hexagonal, franja de color, virola y (si lleva) capuchón.
   */
  private buildHandle(): void {
    const { radius, length } = this.spec.handle;
    const profile = Screwdriver.PROFILE.map(({ r, y }) => new Vector2(r * radius, y * length));
    this.part(new LatheGeometry(profile, GeometryDetail.Thin), this.spec.grip);
    const band = Screwdriver.BAND;
    const ring = WallTool.SHAPES.rod(radius * band.radius, length * band.height, GeometryDetail.Thin);
    this.part(ring, this.spec.band).position.y = length * band.y;
    const ferrule = Screwdriver.FERRULE;
    this.part(
      WallTool.SHAPES.rod(radius * ferrule.radius, length * ferrule.height, GeometryDetail.Low),
      WallTool.PALETTE.chrome,
    ).position.y = (length * ferrule.height) / 2;
    if (this.spec.swivel) {
      this.buildSwivel();
    }
  }

  /**
   * Capuchón giratorio del destornillador de precisión.
   */
  private buildSwivel(): void {
    const { radius, length } = this.spec.handle;
    const { radius: cap, height } = Screwdriver.SWIVEL;
    this.part(
      WallTool.SHAPES.rod(radius * cap, length * height, GeometryDetail.Medium),
      WallTool.PALETTE.chrome,
    ).position.y = length * (1 + height / 2);
  }

  /**
   * Punta plana: hoja que se ensancha y se aplana.
   *
   * @returns Malla de la punta.
   */
  private flatTip(): Mesh {
    const { length, flare, flat } = Screwdriver.TIP;
    const { radius } = this.spec.shaft;
    const geometry = new CylinderGeometry(radius, radius * flare, length, Screwdriver.TIP.sides).rotateY(
      Screwdriver.TIP.square,
    );
    const tip = this.part(geometry, WallTool.PALETTE.chrome);
    tip.scale.z = flat;
    return tip;
  }

  /**
   * Punta de estrella: pirámide de cuatro aristas hacia abajo.
   *
   * @returns Malla de la punta.
   */
  private crossTip(): Mesh {
    const { length, cross } = Screwdriver.TIP;
    const geometry = new ConeGeometry(this.spec.shaft.radius * cross, length, Screwdriver.TIP.sides).rotateX(
      Math.PI,
    );
    return this.part(geometry, WallTool.PALETTE.chrome);
  }
}
