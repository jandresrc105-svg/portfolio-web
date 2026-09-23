import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type CanvasTexture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { ToolId } from '../../models/ToolId';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolOutline } from '../../models/ToolOutline';
import type { ToolWallState } from '../../models/ToolWallState';
import { CaliperDisplay } from './CaliperDisplay';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { WallTool } from './WallTool';

/**
 * Calibrador digital (vernier) de 150 mm colgado en horizontal: regla de acero con su escala grabada, mordaza
 * fija y corredera con la mordaza móvil, la pantalla LCD, los botones, la rueda del pulgar y la varilla de
 * profundidad. La escala es real: 1 mm de lectura es 1 mm de recorrido. Al inspeccionarlo, la apertura mueve
 * la corredera, la rueda gira y la pantalla marca los milímetros.
 */
export class DigitalCaliper extends WallTool {
  private static readonly BEAM = { length: 0.27, height: 0.017, depth: 0.0035 };
  private static readonly ZERO = -0.1;
  private static readonly TRAVEL = 0.15;
  private static readonly FIXED_JAW = [
    { x: -0.132, y: 0.0085 },
    { x: -0.132, y: -0.014 },
    { x: -0.108, y: -0.058 },
    { x: -0.1, y: -0.058 },
    { x: -0.1, y: 0.028 },
    { x: -0.1035, y: 0.028 },
    { x: -0.112, y: 0.0085 },
  ];
  private static readonly MOVING_JAW = [
    { x: -0.1, y: -0.0105 },
    { x: -0.1, y: -0.058 },
    { x: -0.092, y: -0.058 },
    { x: -0.07, y: -0.016 },
    { x: -0.07, y: -0.0105 },
  ];
  private static readonly UPPER_JAW = [
    { x: -0.088, y: 0.0105 },
    { x: -0.0965, y: 0.028 },
    { x: -0.1, y: 0.028 },
    { x: -0.1, y: 0.0105 },
  ];
  private static readonly JAW_DEPTH = 0.0035;
  private static readonly HEAD = {
    x: -0.066,
    y: 0.0005,
    width: 0.068,
    height: 0.024,
    depth: 0.011,
    z: 0.002,
  };
  private static readonly SCREEN = { x: -0.068, y: 0.0035, width: 0.038, height: 0.0115, lift: 0.0003 };
  private static readonly BUTTONS = [{ x: -0.087 }, { x: -0.05 }];
  private static readonly BUTTON = { y: -0.0065, radius: 0.0022, depth: 0.0016 };
  private static readonly WHEEL = { x: -0.036, y: -0.0135, radius: 0.0042, depth: 0.003 };
  private static readonly ROD = { size: 0.0016, start: -0.034, y: -0.004, z: -0.0024 };
  private static readonly SCALE = {
    pixelsPerMeter: 1900,
    height: 32,
    color: '#1a1d21',
    base: '#c3cad1',
    tick: { small: 7, medium: 11, large: 15 },
    every: { medium: 5, large: 10 },
    font: 10,
  };
  private static readonly SCALE_FINISH = { roughness: 0.3, metalness: 0.85, envMapIntensity: 0.5 };
  private static readonly PEGS = [
    { x: 0.02, y: -0.012 },
    { x: 0.1, y: -0.012 },
  ];
  private static readonly SHADOW = [
    { x: 0, y: 0, width: 0.272, height: 0.019, round: 0.2 },
    { x: -0.116, y: -0.024, width: 0.034, height: 0.07, round: 0.2 },
    { x: -0.066, y: -0.012, width: 0.07, height: 0.05, round: 0.2 },
  ];
  private static readonly BOUNDS = { x: 0, y: -0.015, width: 0.275, height: 0.09 };

  private readonly slider = new Group();
  private readonly wheel = new Group();
  private readonly screen = new MeshBasicMaterial();
  private readonly display: CaliperDisplay;

  /**
   * Crea el calibrador.
   *
   * @param textures Fábrica de texturas (escala grabada y pantalla).
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super(ToolId.Caliper);
    this.display = new CaliperDisplay(textures);
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    return DigitalCaliper.PEGS;
  }

  /**
   * @inheritdoc
   */
  public override pose(state: ToolWallState): void {
    const travel = state.open * DigitalCaliper.TRAVEL;
    this.slider.position.x = travel;
    this.wheel.rotation.z = -travel / DigitalCaliper.WHEEL.radius;
    this.display.show(state.reading);
  }

  /**
   * @inheritdoc
   */
  public override update(delta: number, elapsed: number): void {
    super.update(delta, elapsed);
    this.display.refresh(delta);
  }

  /**
   * @inheritdoc
   */
  public override setPower(level: number): void {
    super.setPower(level);
    this.display.setPower(this.screen, level);
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    super.dispose();
    this.display.dispose();
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    return DigitalCaliper.SHADOW;
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    this.buildBeam();
    const palette = WallTool.PALETTE;
    this.part(WallTool.SHAPES.plate(DigitalCaliper.FIXED_JAW, DigitalCaliper.JAW_DEPTH), palette.steel);
    this.part(
      WallTool.SHAPES.plate(DigitalCaliper.MOVING_JAW, DigitalCaliper.JAW_DEPTH),
      palette.steel,
      this.slider,
    );
    this.part(
      WallTool.SHAPES.plate(DigitalCaliper.UPPER_JAW, DigitalCaliper.JAW_DEPTH),
      palette.steel,
      this.slider,
    );
    this.buildHead();
    this.buildControls();
    this.body.add(this.slider);
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    return DigitalCaliper.BOUNDS;
  }

  /**
   * Regla de acero con la escala grabada al frente.
   */
  private buildBeam(): void {
    const { length, height, depth } = DigitalCaliper.BEAM;
    const engraved = new MeshStandardMaterial({
      ...DigitalCaliper.SCALE_FINISH,
      map: this.keep(this.scaleArt()),
    });
    const steel = this.finish(WallTool.PALETTE.steel);
    const beam = new Mesh(new BoxGeometry(length, height, depth), [
      steel,
      steel,
      steel,
      steel,
      engraved,
      steel,
    ]);
    this.body.add(beam);
    this.buildRod();
  }

  /**
   * Varilla de profundidad: va detrás de la regla y sale por su extremo al abrir.
   */
  private buildRod(): void {
    const { size, start, y, z } = DigitalCaliper.ROD;
    const reach = DigitalCaliper.BEAM.length / 2 - start;
    const rod = this.part(new BoxGeometry(reach, size, size), WallTool.PALETTE.chrome, this.slider);
    rod.position.set(start + reach / 2, y, z);
  }

  /**
   * Cuerpo de la corredera con la pantalla LCD.
   */
  private buildHead(): void {
    const { x, y, width, height, depth, z } = DigitalCaliper.HEAD;
    const head = this.part(new BoxGeometry(width, height, depth), WallTool.PALETTE.caliperBody, this.slider);
    head.position.set(x, y, z);
    const screen = DigitalCaliper.SCREEN;
    this.screen.map = this.display.texture;
    const lcd = new Mesh(new PlaneGeometry(screen.width, screen.height), this.screen);
    lcd.position.set(screen.x, screen.y, z + depth / 2 + screen.lift);
    this.slider.add(lcd);
    this.display.setPower(this.screen, this.level);
  }

  /**
   * Botones de la corredera y rueda del pulgar.
   */
  private buildControls(): void {
    const { z, depth } = DigitalCaliper.HEAD;
    const { y, radius, depth: height } = DigitalCaliper.BUTTON;
    DigitalCaliper.BUTTONS.forEach(({ x }) => {
      const button = this.part(
        WallTool.SHAPES.disc(radius, height, GeometryDetail.Low),
        WallTool.PALETTE.teflon,
        this.slider,
      );
      button.position.set(x, y, z + depth / 2);
    });
    const wheel = DigitalCaliper.WHEEL;
    this.part(
      WallTool.SHAPES.disc(wheel.radius, wheel.depth, GeometryDetail.Thin),
      WallTool.PALETTE.darkSteel,
      this.wheel,
    );
    this.wheel.position.set(wheel.x, wheel.y, z);
    this.slider.add(this.wheel);
  }

  /**
   * Dibuja la escala: una raya por milímetro, más larga cada 5 y con el número cada 10.
   *
   * @returns Textura de la cara de la regla.
   */
  private scaleArt(): CanvasTexture {
    const { pixelsPerMeter, height, color, base } = DigitalCaliper.SCALE;
    const width = DigitalCaliper.BEAM.length * pixelsPerMeter;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = base;
      context.fillRect(0, 0, width, height);
      context.fillStyle = color;
      context.font = `bold ${String(DigitalCaliper.SCALE.font)}px ${CanvasTextureFactory.SANS_FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      for (
        let millimeter = 0;
        millimeter <= DigitalCaliper.TRAVEL * CaliperDisplay.MILLIMETERS;
        millimeter += 1
      ) {
        this.tick(context, millimeter);
      }
    });
  }

  /**
   * Una raya de la escala (y su número cada centímetro).
   *
   * @param context Contexto de dibujo.
   * @param millimeter Milímetro.
   */
  private tick(context: CanvasRenderingContext2D, millimeter: number): void {
    const { pixelsPerMeter, height, tick, every } = DigitalCaliper.SCALE;
    const x =
      (DigitalCaliper.ZERO + DigitalCaliper.BEAM.length / 2 + millimeter / CaliperDisplay.MILLIMETERS) *
      pixelsPerMeter;
    const large = millimeter % every.large === 0;
    let length = millimeter % every.medium === 0 ? tick.medium : tick.small;
    if (large) {
      length = tick.large;
    }
    context.fillRect(x, 0, 1, length);
    if (large) {
      context.fillText(String(millimeter / every.large), x, height);
    }
  }
}
