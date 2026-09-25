import {
  CatmullRomCurve3,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  TubeGeometry,
  Vector3,
  type CanvasTexture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { ToolId } from '../../models/ToolId';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolOutline } from '../../models/ToolOutline';
import type { ToolWallState } from '../../models/ToolWallState';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { WallTool } from './WallTool';

/**
 * Rollo de estaño: carrete naranja con el alambre enrollado en vueltas apretadas, etiqueta con la aleación y
 * el diámetro, y la punta del alambre suelta. Cuelga por el agujero del eje. Al inspeccionarlo gira sobre su
 * eje, como al desenrollarlo.
 */
export class SolderSpool extends WallTool {
  private static readonly FLANGE = { radius: 0.042, depth: 0.003, z: 0.0135 };
  private static readonly DRUM = { radius: 0.033, depth: 0.024 };
  private static readonly HUB = { radius: 0.0105, depth: 0.031 };
  private static readonly WINDINGS = {
    width: 8,
    height: 96,
    step: 3,
    line: 1,
    color: '#5d6166',
    base: '#ffffff',
  };
  private static readonly LABEL = {
    inner: 0.0125,
    outer: 0.036,
    lift: 0.0003,
    size: 128,
    paper: '#f4efe4',
    ink: '#b0331f',
    dark: '#23262a',
    title: 26,
    body: 14,
    top: 0.2,
    bottom: 0.82,
  };
  private static readonly LABEL_FINISH = { roughness: 0.6, metalness: 0, envMapIntensity: 0.15 };
  private static readonly TAIL = {
    radius: 0.0008,
    points: [
      { x: 0.024, y: -0.022, z: 0.004 },
      { x: 0.036, y: -0.03, z: 0.008 },
      { x: 0.043, y: -0.05, z: 0.011 },
      { x: 0.038, y: -0.07, z: 0.01 },
    ],
  };
  private static readonly HOOK = [{ x: 0, y: 0.0062 }];

  /**
   * Crea el rollo.
   *
   * @param textures Fábrica de texturas (vueltas del alambre y etiqueta).
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super(ToolId.Solder);
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    return SolderSpool.HOOK;
  }

  /**
   * @inheritdoc
   */
  public override pose(state: ToolWallState): void {
    this.body.rotation.z = -state.turn;
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    const size = SolderSpool.FLANGE.radius * 2;
    return [{ x: 0, y: 0, width: size, height: size, round: 0.5 }];
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    const palette = WallTool.PALETTE;
    const { radius, depth, z } = SolderSpool.FLANGE;
    [z, -z].forEach((offset) => {
      this.part(WallTool.SHAPES.disc(radius, depth, GeometryDetail.High), palette.spool).position.z = offset;
    });
    this.part(
      WallTool.SHAPES.disc(SolderSpool.DRUM.radius, SolderSpool.DRUM.depth, GeometryDetail.High),
      palette.solder,
    );
    this.windings(this.finish(palette.solder));
    this.part(WallTool.SHAPES.disc(SolderSpool.HUB.radius, SolderSpool.HUB.depth), palette.blackRubber);
    this.buildLabel();
    this.buildTail();
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    const size = SolderSpool.FLANGE.radius * 2;
    return { x: 0, y: 0, width: size, height: size };
  }

  /**
   * Vueltas del alambre como surcos sobre el tambor.
   *
   * @param material Material del tambor.
   */
  private windings(material: MeshStandardMaterial): void {
    const { width, height, step, line, color, base } = SolderSpool.WINDINGS;
    material.map = this.keep(
      this.textures.paint(width, height, (context) => {
        context.fillStyle = base;
        context.fillRect(0, 0, width, height);
        context.fillStyle = color;
        for (let y = 0; y < height; y += step) {
          context.fillRect(0, y, width, line);
        }
      }),
    );
  }

  /**
   * Etiqueta anular en la cara del carrete.
   */
  private buildLabel(): void {
    const { inner, outer, lift } = SolderSpool.LABEL;
    const material = new MeshStandardMaterial({
      ...SolderSpool.LABEL_FINISH,
      map: this.keep(this.labelArt()),
    });
    const label = new Mesh(new RingGeometry(inner, outer, GeometryDetail.High), material);
    const { z, depth } = SolderSpool.FLANGE;
    label.position.z = z + depth / 2 + lift;
    this.body.add(label);
  }

  /**
   * Dibuja la etiqueta: aleación arriba y diámetro con flux abajo.
   *
   * @returns Textura.
   */
  private labelArt(): CanvasTexture {
    const { size, paper, ink, dark, title, body, top, bottom } = SolderSpool.LABEL;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = paper;
      context.fillRect(0, 0, size, size);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillStyle = ink;
      context.font = `bold ${String(title)}px ${CanvasTextureFactory.SANS_FONT}`;
      context.fillText('Sn63 Pb37', size / 2, size * top);
      context.fillStyle = dark;
      context.font = `bold ${String(body)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText('Ø 0,8 mm · FLUX', size / 2, size * bottom);
    });
  }

  /**
   * Punta del alambre que cuelga suelta.
   */
  private buildTail(): void {
    const { radius, points } = SolderSpool.TAIL;
    const curve = new CatmullRomCurve3(points.map(({ x, y, z }) => new Vector3(x, y, z)));
    const geometry = new TubeGeometry(curve, GeometryDetail.Low, radius, GeometryDetail.Wire);
    this.part(geometry, WallTool.PALETTE.solder);
  }
}
