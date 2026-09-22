import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  QuadraticBezierCurve3,
  SpotLight,
  TubeGeometry,
  Vector3,
  type Material,
  type Vector3Like,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Poste eléctrico con farola, transformador, cables colgantes y tablero de breakers con LEDs.
 */
export class UtilityPole extends SceneObject implements Updatable, Powerable {
  private static readonly BASE = { x: -3.75, z: -0.95 };
  private static readonly POLE = { radius: 0.11, top: 0.08, height: 6.6 };
  private static readonly ARMS = [
    { y: 6.2, width: 1.9 },
    { y: 5.75, width: 1.4 },
  ];
  private static readonly ARM_SIZE = 0.1;
  private static readonly TRANSFORMER = { radius: 0.24, height: 0.62, x: 0.34, y: 4.9 };
  private static readonly LAMP = { armLength: 1.3, y: 4.55, headWidth: 0.42, color: 0xd6e6ff, intensity: 38 };
  private static readonly PANEL = { width: 0.46, height: 0.62, depth: 0.16, y: 1.55, z: 0.17 };
  private static readonly LED = { size: 0.035, spacing: 0.1, y: 1.74, blinkSpeed: 3.2 };
  private static readonly WIRE_RADIUS = 0.012;
  private static readonly WIRE_SAG = 0.9;
  private static readonly WIRE_ENDS = [
    { x: -14, y: 5.4, z: -9 },
    { x: 9, y: 7.5, z: -14 },
    { x: 1.6, y: 2.95, z: -1.1 },
  ];
  private static readonly LAMP_HEAD = { height: 0.08, depth: 0.22 };
  private static readonly LAMP_ARM = { height: 0.06 };
  private static readonly LAMP_GLOW = 6;
  private static readonly OFF_GLOW = 0.03;
  private static readonly SPOT = { distance: 14, angle: 0.75, penumbra: 0.6 };
  private static readonly LED_RED = 0xff2233;
  private static readonly LED_GREEN = 0x22ff88;
  private static readonly LED_GLOW = 5;

  private readonly lamp = new MeshBasicMaterial({ color: UtilityPole.LAMP.color });
  private readonly spot = new SpotLight(
    UtilityPole.LAMP.color,
    0,
    UtilityPole.SPOT.distance,
    UtilityPole.SPOT.angle,
    UtilityPole.SPOT.penumbra,
    2,
  );
  private readonly redLed = new MeshBasicMaterial({ color: UtilityPole.LED_RED });
  private readonly greenLed = new MeshBasicMaterial({ color: UtilityPole.LED_GREEN });
  private level = 0;

  /**
   * Crea el poste.
   *
   * @param materials Materiales compartidos.
   */
  public constructor(private readonly materials: MaterialLibrary) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.lamp.color
      .set(UtilityPole.LAMP.color)
      .multiplyScalar(Math.max(level * UtilityPole.LAMP_GLOW, UtilityPole.OFF_GLOW));
    this.spot.intensity = level * UtilityPole.LAMP.intensity;
    this.greenLed.color
      .set(UtilityPole.LED_GREEN)
      .multiplyScalar(Math.max(level * UtilityPole.LED_GLOW, UtilityPole.OFF_GLOW));
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const blink =
      Math.sin(elapsed * UtilityPole.LED.blinkSpeed) > 0 ? UtilityPole.LED_GLOW : UtilityPole.OFF_GLOW;
    this.redLed.color.set(UtilityPole.LED_RED).multiplyScalar(this.level > 0 ? blink : UtilityPole.OFF_GLOW);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { radius, top, height } = UtilityPole.POLE;
    this.add(
      new Mesh(new CylinderGeometry(top, radius, height, GeometryDetail.Low), this.materials.concrete),
      {
        x: 0,
        y: height / 2,
        z: 0,
      },
    );
    this.buildArms();
    this.buildLamp();
    this.buildPanel();
    this.buildWires();
    this.root.position.set(UtilityPole.BASE.x, 0, UtilityPole.BASE.z);
    this.setPower(0);
  }

  /**
   * Crucetas y transformador.
   */
  private buildArms(): void {
    const size = UtilityPole.ARM_SIZE;
    UtilityPole.ARMS.forEach(({ y, width }) => {
      this.box({ x: width, y: size, z: size }, { x: 0, y, z: 0 }, this.materials.darkMetal);
    });
    const { radius, height, x, y } = UtilityPole.TRANSFORMER;
    this.add(
      new Mesh(new CylinderGeometry(radius, radius, height, GeometryDetail.Medium), this.materials.metal),
      {
        x,
        y,
        z: 0,
      },
    );
  }

  /**
   * Brazo de farola con cabezal luminoso y foco hacia la calle.
   */
  private buildLamp(): void {
    const { armLength, y, headWidth } = UtilityPole.LAMP;
    const { height, depth } = UtilityPole.LAMP_HEAD;
    this.box(
      { x: armLength, y: UtilityPole.LAMP_ARM.height, z: UtilityPole.LAMP_ARM.height },
      { x: armLength / 2, y, z: 0 },
      this.materials.darkMetal,
    );
    this.box({ x: headWidth, y: height, z: depth }, { x: armLength, y: y - height, z: 0 }, this.lamp);
    this.add(this.spot, { x: armLength, y: y - height, z: 0 });
    this.spot.target.position.set(armLength + 1, 0, 2);
    this.add(this.spot.target);
  }

  /**
   * Tablero de breakers con LED de estado (verde fijo, rojo intermitente).
   */
  private buildPanel(): void {
    const { width, height, depth, y, z } = UtilityPole.PANEL;
    this.box({ x: width, y: height, z: depth }, { x: 0, y, z }, this.materials.metal);
    const { size, spacing, y: ledY } = UtilityPole.LED;
    const front = z + depth / 2;
    this.box({ x: size, y: size, z: size }, { x: -spacing, y: ledY, z: front }, this.greenLed);
    this.box({ x: size, y: size, z: size }, { x: spacing, y: ledY, z: front }, this.redLed);
  }

  /**
   * Cables que cuelgan desde la cruceta hacia la oscuridad y hacia el techo del puesto.
   */
  private buildWires(): void {
    const [upper] = UtilityPole.ARMS;
    const top = upper?.y ?? UtilityPole.POLE.height;
    UtilityPole.WIRE_ENDS.forEach((end) => {
      const start = new Vector3(0, top, 0);
      const finish = new Vector3(end.x - UtilityPole.BASE.x, end.y, end.z - UtilityPole.BASE.z);
      const middle = start.clone().lerp(finish, 0.5);
      middle.y -= UtilityPole.WIRE_SAG;
      const curve = new QuadraticBezierCurve3(start, middle, finish);
      this.add(
        new Mesh(
          new TubeGeometry(curve, GeometryDetail.Curve, UtilityPole.WIRE_RADIUS, GeometryDetail.Wire),
          this.materials.cable,
        ),
      );
    });
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Posición.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }
}
