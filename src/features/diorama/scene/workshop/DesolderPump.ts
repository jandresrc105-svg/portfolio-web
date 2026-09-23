import { BoxGeometry, CylinderGeometry, Group } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { ToolId } from '../../models/ToolId';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolOutline } from '../../models/ToolOutline';
import type { ToolWallState } from '../../models/ToolWallState';
import { WallTool } from './WallTool';

/**
 * Succionador de estaño: cuerpo de aluminio anodizado azul con funda de goma, boquilla de teflón, tapa,
 * botón de disparo y el émbolo con su perilla. Cuelga de la tapa sobre dos clavijas. Al inspeccionarlo, la
 * apertura arma el émbolo (lo saca hacia arriba), como antes de disparar sobre una unión fundida.
 */
export class DesolderPump extends WallTool {
  private static readonly BODY = { radius: 0.0125, length: 0.12 };
  private static readonly SLEEVE = { radius: 0.0134, length: 0.05, y: -0.082 };
  private static readonly COLLAR = { radius: 0.0105, length: 0.012 };
  private static readonly NOZZLE = { top: 0.0062, bottom: 0.0022, length: 0.032 };
  private static readonly CAP = { radius: 0.0132, length: 0.01 };
  private static readonly ROD = { radius: 0.0034, length: 0.075, rest: -0.05, travel: 0.058 };
  private static readonly KNOB = { radius: 0.009, length: 0.012 };
  private static readonly BUTTON = { width: 0.0055, height: 0.013, depth: 0.006, y: -0.022 };
  private static readonly PEG = { gap: 0.0045, drop: 0.0045 };
  private static readonly SHADOW = { width: 0.028, round: 0.45 };

  private readonly plunger = new Group();

  /**
   * Crea el succionador.
   */
  public constructor() {
    super(ToolId.DesolderPump);
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    const { gap, drop } = DesolderPump.PEG;
    const x = DesolderPump.BODY.radius + gap;
    return [
      { x: -x, y: -drop },
      { x, y: -drop },
    ];
  }

  /**
   * @inheritdoc
   */
  public override pose(state: ToolWallState): void {
    const { rest, travel } = DesolderPump.ROD;
    this.plunger.position.y = rest + travel * state.open;
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    const { y, height } = DesolderPump.span();
    const { width, round } = DesolderPump.SHADOW;
    return [{ x: 0, y, width, height, round }];
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    this.buildBody();
    const cap = DesolderPump.CAP;
    this.part(
      WallTool.SHAPES.rod(cap.radius, cap.length, GeometryDetail.Medium),
      WallTool.PALETTE.blackRubber,
    ).position.y = cap.length / 2;
    this.buildButton();
    this.buildPlunger();
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    const { y, height } = DesolderPump.span();
    return { x: 0, y, width: DesolderPump.SHADOW.width, height };
  }

  /**
   * Cuerpo anodizado con su funda, el collar y la boquilla de teflón.
   */
  private buildBody(): void {
    const palette = WallTool.PALETTE;
    const { radius, length } = DesolderPump.BODY;
    this.part(WallTool.SHAPES.rod(radius, length, GeometryDetail.Medium), palette.anodized).position.y =
      -length / 2;
    const sleeve = DesolderPump.SLEEVE;
    this.part(
      WallTool.SHAPES.rod(sleeve.radius, sleeve.length, GeometryDetail.Medium),
      palette.blackRubber,
    ).position.y = sleeve.y;
    const collar = DesolderPump.COLLAR;
    this.part(WallTool.SHAPES.rod(collar.radius, collar.length), palette.blackRubber).position.y =
      -length - collar.length / 2;
    const { top, bottom, length: nozzle } = DesolderPump.NOZZLE;
    this.part(new CylinderGeometry(top, bottom, nozzle, GeometryDetail.Low), palette.teflon).position.y =
      -length - collar.length - nozzle / 2;
  }

  /**
   * Botón de disparo al costado.
   */
  private buildButton(): void {
    const { width, height, depth, y } = DesolderPump.BUTTON;
    const button = this.part(new BoxGeometry(width, height, depth), WallTool.PALETTE.redGrip);
    button.position.set(DesolderPump.BODY.radius, y, 0);
  }

  /**
   * Émbolo: vástago cromado y perilla, que suben al armarlo.
   */
  private buildPlunger(): void {
    const { radius, length, rest } = DesolderPump.ROD;
    const palette = WallTool.PALETTE;
    this.part(WallTool.SHAPES.rod(radius, length), palette.chrome, this.plunger).position.y = length / 2;
    const knob = DesolderPump.KNOB;
    const shape = WallTool.SHAPES.rod(knob.radius, knob.length, GeometryDetail.Medium);
    this.part(shape, palette.blackRubber, this.plunger).position.y = length + knob.length / 2;
    this.plunger.position.y = rest;
    this.body.add(this.plunger);
  }

  /**
   * Extensión vertical del succionador colgado (de la punta de la boquilla a la perilla).
   *
   * @returns Centro y alto.
   */
  private static span(): { y: number; height: number } {
    const top = DesolderPump.ROD.rest + DesolderPump.ROD.length + DesolderPump.KNOB.length;
    const bottom = -DesolderPump.BODY.length - DesolderPump.COLLAR.length - DesolderPump.NOZZLE.length;
    return { y: (top + bottom) / 2, height: top - bottom };
  }
}
