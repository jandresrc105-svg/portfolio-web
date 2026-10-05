import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { ShopFixture } from '../../models/ShopFixture';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { ClosingRoutine } from '../ClosingRoutine';
import type { MaterialLibrary } from '../MaterialLibrary';
import { MeshPresence } from '../MeshPresence';
import { RollShutter } from './RollShutter';
import { Stall } from './Stall';

/**
 * Cortinas metálicas enrollables que cierran el ramen por completo: una entre la cocina y la barra, que el
 * cocinero baja tirando de la correa hasta que la barra de abajo se apoya en el borde interior del mostrador (la
 * barra y los taburetes quedan afuera), y una en cada costado, por fuera de la persiana de bambú, que baja hasta
 * la pared lateral un poco antes. Sobre las cajas de los costados, un frontón de madera tapa el triángulo que deja
 * el techo inclinado. Por fuera de la cortina del frente cuelga el cartel de madera "準備中" (en preparación), que
 * aparece al salir de la caja.
 */
export class StallShutter extends SceneObject implements Updatable, ShopFixture {
  /** Dónde cuelga la correa (x) y en qué plano baja la cortina del frente (z), para que el cocinero la alcance. */
  public static readonly STRAP = { x: -0.25, z: 0.43, length: 0.5 };

  private static readonly FRONT = { width: 4.26, top: 2.62, bottom: 1.09 };
  private static readonly SIDE = { width: 3.02, top: 2.64, bottom: 1.15, x: 2.31, z: -0.2 };
  private static readonly HOUSING_HEIGHT = 0.16;
  private static readonly STRAP_SIZE = { width: 0.035, depth: 0.006, inset: 0.025, color: 0x2a2e36 };
  private static readonly SIGN = { x: 0.95, width: 0.62, height: 0.27, depth: 0.025, above: 0.32, gap: 0.02 };
  private static readonly SIGN_CANVAS = { width: 320, height: 140, border: 10 };
  private static readonly SIGN_TEXT = {
    title: '準備中',
    titleSize: 76,
    titleY: 62,
    subtitle: 'CERRADO',
    subtitleSize: 22,
    subtitleY: 116,
  };
  private static readonly SIGN_COLORS = { wood: '#c39a62', edge: '#7a5530', ink: '#2b1a10' };

  private readonly routine = new ClosingRoutine();
  private readonly sign = new Group();
  private readonly presence = new MeshPresence(this.sign);
  private front: RollShutter | null = null;
  private readonly sides: RollShutter[] = [];

  /**
   * Crea las cortinas.
   *
   * @param textures Fábrica de texturas.
   * @param materials Materiales compartidos (la madera de los frontones).
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly materials: MaterialLibrary,
  ) {
    super();
  }

  /**
   * Altura de la barra de abajo de la cortina del frente según cuánto bajó.
   *
   * @param pulled 0 = enrollada, 1 = cerrada.
   * @returns Altura en el mundo.
   */
  public static barHeight(pulled: number): number {
    const { top, bottom } = StallShutter.FRONT;
    return top + (bottom - top) * pulled;
  }

  /**
   * @inheritdoc
   */
  public setClosure(progress: number): void {
    const barY = this.front?.setPulled(this.routine.pull(progress)) ?? StallShutter.FRONT.top;
    const sides = this.routine.sides(progress);
    this.sides.forEach((side) => {
      side.setPulled(sides);
    });
    const { height, above } = StallShutter.SIGN;
    this.presence.set(barY + above + height / 2 < StallShutter.FRONT.top);
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    this.presence.enforce();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const corrugated = this.own(this.textures.corrugated());
    this.front = new RollShutter(this.own(corrugated.clone()), StallShutter.FRONT);
    this.add(this.front.group, { x: 0, y: 0, z: StallShutter.STRAP.z });
    this.buildStrap(this.front);
    this.buildSign(this.front);
    [-1, 1].forEach((side) => {
      const shutter = new RollShutter(this.own(corrugated.clone()), StallShutter.SIDE);
      shutter.group.rotation.y = (side * Math.PI) / 2;
      this.add(shutter.group, { x: side * StallShutter.SIDE.x, y: 0, z: StallShutter.SIDE.z });
      this.sides.push(shutter);
      this.add(this.gable(side));
    });
    this.setClosure(0);
  }

  /**
   * Correa que cuelga de la barra de la cortina del frente, del lado de la cocina.
   *
   * @param front Cortina del frente.
   */
  private buildStrap(front: RollShutter): void {
    const { x, length } = StallShutter.STRAP;
    const { width, depth, inset, color } = StallShutter.STRAP_SIZE;
    const belt = new Mesh(
      new BoxGeometry(width, length, depth),
      new MeshStandardMaterial({ color, roughness: 0.9 }),
    );
    belt.position.set(x, -length / 2, -inset);
    front.bar.add(belt);
  }

  /**
   * Cartel de madera colgado por fuera de la cortina del frente, sobre la barra de abajo.
   *
   * @param front Cortina del frente.
   */
  private buildSign(front: RollShutter): void {
    const { x, width, height, depth, above, gap } = StallShutter.SIGN;
    const map = this.own(this.signTexture());
    const wood = new MeshStandardMaterial({ color: StallShutter.SIGN_COLORS.edge, roughness: 0.85 });
    const plank = new Mesh(new BoxGeometry(width, height, depth), wood);
    const face = new Mesh(
      new PlaneGeometry(width, height),
      new MeshStandardMaterial({ map, roughness: 0.8 }),
    );
    face.position.z = depth / 2 + gap / 2;
    this.sign.add(plank, face);
    this.sign.position.set(x, above + height / 2, gap + depth / 2);
    front.bar.add(this.sign);
  }

  /**
   * Frontón de madera sobre la caja de un costado, hasta la cara inferior del techo inclinado.
   *
   * @param side -1 = izquierda, 1 = derecha.
   * @returns Malla del frontón (en el mundo).
   */
  private gable(side: number): Mesh {
    const { width, top, x, z } = StallShutter.SIDE;
    const base = top + StallShutter.HOUSING_HEIGHT;
    const front = z + width / 2;
    const back = z - width / 2;
    const shape = new Shape();
    shape.moveTo(-front, base);
    shape.lineTo(-back, base);
    shape.lineTo(-back, Math.max(Stall.roofUnderside(back), base));
    shape.lineTo(-front, Math.max(Stall.roofUnderside(front), base));
    shape.closePath();
    const geometry = new ShapeGeometry(shape).rotateY(Math.PI / 2).translate(side * x, 0, 0);
    const wood = this.own(this.materials.woodDark.clone());
    wood.side = DoubleSide;
    return new Mesh(geometry, wood);
  }

  /**
   * Madera con el texto pintado.
   *
   * @returns Textura del cartel.
   */
  private signTexture(): ReturnType<CanvasTextureFactory['paint']> {
    const { width, height, border } = StallShutter.SIGN_CANVAS;
    const { title, titleSize, titleY, subtitle, subtitleSize, subtitleY } = StallShutter.SIGN_TEXT;
    const { wood, edge, ink } = StallShutter.SIGN_COLORS;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = edge;
      context.fillRect(0, 0, width, height);
      context.fillStyle = wood;
      context.fillRect(border, border, width - border * 2, height - border * 2);
      context.fillStyle = ink;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `900 ${String(titleSize)}px ${CanvasTextureFactory.JAPANESE_FONT}`;
      context.fillText(title, width / 2, titleY);
      context.font = `800 ${String(subtitleSize)}px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText(subtitle, width / 2, subtitleY);
    });
  }
}
