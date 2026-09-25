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
import type { Powerable } from '../../models/Powerable';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Poste eléctrico con farola, transformador y cables colgantes. El tablero de la trayectoria va aparte
 * (`BreakerPanel`), montado en el poste.
 */
export class UtilityPole extends SceneObject implements Powerable {
  private static readonly BASE = { x: -3.75, z: -0.95 };
  private static readonly POLE = { radius: 0.11, top: 0.08, height: 6.6 };
  private static readonly ARMS = [
    { y: 6.2, width: 1.9 },
    { y: 5.75, width: 1.4 },
  ];
  private static readonly ARM_SIZE = 0.1;
  private static readonly TRANSFORMER = { radius: 0.24, height: 0.62, x: 0.34, y: 4.9 };
  private static readonly LAMP = {
    armLength: -1.3,
    y: 4.55,
    headWidth: 0.42,
    color: 0xd6e6ff,
    intensity: 38,
  };
  private static readonly WIRE_RADIUS = 0.012;
  private static readonly WIRE_SAG = 0.9;
  private static readonly WIRE_ENDS = [
    { x: -14, y: 5.4, z: -9 },
    { x: 9, y: 7.5, z: -14 },
    { x: -2.3, y: 5.3, z: -1.3 },
  ];
  private static readonly LAMP_HEAD = { height: 0.08, depth: 0.22 };
  private static readonly LAMP_ARM = { height: 0.06 };
  private static readonly LAMP_GLOW = 6;
  private static readonly OFF_GLOW = 0.03;
  private static readonly SPOT = { distance: 14, angle: 0.75, penumbra: 0.6 };

  private readonly lamp = new MeshBasicMaterial({ color: UtilityPole.LAMP.color });
  private readonly spot = new SpotLight(
    UtilityPole.LAMP.color,
    0,
    UtilityPole.SPOT.distance,
    UtilityPole.SPOT.angle,
    UtilityPole.SPOT.penumbra,
    2,
  );

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
    this.lamp.color
      .set(UtilityPole.LAMP.color)
      .multiplyScalar(Math.max(level * UtilityPole.LAMP_GLOW, UtilityPole.OFF_GLOW));
    this.spot.intensity = level * UtilityPole.LAMP.intensity;
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
   * Brazo de farola con cabezal luminoso y foco hacia la calle de la izquierda (lejos del edificio).
   */
  private buildLamp(): void {
    const { armLength, y, headWidth } = UtilityPole.LAMP;
    const { height, depth } = UtilityPole.LAMP_HEAD;
    this.box(
      { x: Math.abs(armLength), y: UtilityPole.LAMP_ARM.height, z: UtilityPole.LAMP_ARM.height },
      { x: armLength / 2, y, z: 0 },
      this.materials.darkMetal,
    );
    this.box({ x: headWidth, y: height, z: depth }, { x: armLength, y: y - height, z: 0 }, this.lamp);
    this.add(this.spot, { x: armLength, y: y - height, z: 0 });
    this.spot.target.position.set(armLength + Math.sign(armLength), 0, 2);
    this.add(this.spot.target);
  }

  /**
   * Cables que cuelgan desde la cruceta hacia la oscuridad y la acometida al segundo piso del edificio.
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
