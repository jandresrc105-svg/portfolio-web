import { BoxGeometry, CylinderGeometry, Group, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Microservo tipo SG90 acostado con el eje hacia arriba: cuerpo azul, orejas de montaje, eje blanco y un
 * brazo que gira como el de verdad (a velocidad limitada, unos 600° por segundo). 0° y 180° son los extremos;
 * 90° deja el brazo mirando al frente. El grupo tiene origen al pie del servo.
 */
export class ServoMotor {
  private static readonly BODY = { width: 0.04, height: 0.036, depth: 0.02, color: 0x2b56c9 };
  private static readonly TABS = { width: 0.056, height: 0.003, y: 0.027 };
  private static readonly SHAFT = { radius: 0.006, height: 0.006, x: 0.01, color: 0xf2f2f2 };
  private static readonly ARM = { length: 0.045, width: 0.007, height: 0.003, hub: 0.0055 };
  private static readonly SPEED = 10.5;
  private static readonly REST = 90;
  private static readonly DEGREES = MathUtils.DEG2RAD;
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly body = new MeshStandardMaterial({ color: ServoMotor.BODY.color, roughness: 0.4 });
  private readonly horn = new Group();
  private angle = ServoMotor.REST;

  /**
   * Crea el servo.
   */
  public constructor() {
    const { width, height, depth } = ServoMotor.BODY;
    this.hitArea = new Mesh(new BoxGeometry(width, height, depth), this.body);
  }

  /**
   * Ángulo actual del brazo.
   *
   * @returns Grados.
   */
  public get degrees(): number {
    return this.angle;
  }

  /**
   * Construye el servo.
   *
   * @returns Grupo del servo.
   */
  public build(): Group {
    const body = ServoMotor.BODY;
    this.hitArea.position.y = body.height / 2;
    const tabs = ServoMotor.TABS;
    const ears = new Mesh(new BoxGeometry(tabs.width, tabs.height, body.depth), this.body);
    ears.position.y = tabs.y;
    const shaft = ServoMotor.SHAFT;
    const white = new MeshStandardMaterial({ color: shaft.color, roughness: 0.45, envMapIntensity: 0.2 });
    const post = new Mesh(
      new CylinderGeometry(shaft.radius, shaft.radius, shaft.height, GeometryDetail.Low),
      white,
    );
    post.position.set(shaft.x, body.height + shaft.height / 2, 0);
    this.horn.position.set(shaft.x, body.height + shaft.height, 0);
    this.buildArm(white);
    this.group.add(this.hitArea, ears, post, this.horn);
    return this.group;
  }

  /**
   * Punto donde entra el cable del servo, para cablearlo a la protoboard.
   *
   * @returns Punto en el espacio del grupo.
   */
  public lead(): Vector3 {
    const { width, height } = ServoMotor.BODY;
    return new Vector3(-width / 2, height / 2, 0);
  }

  /**
   * Gira el brazo hacia el ángulo pedido a velocidad limitada.
   *
   * @param target Ángulo pedido (grados).
   * @param delta Segundos desde el frame anterior.
   */
  public show(target: number, delta: number): void {
    const step = (ServoMotor.SPEED * delta) / ServoMotor.DEGREES;
    this.angle += Math.min(Math.max(target - this.angle, -step), step);
    this.horn.rotation.y = (this.angle - ServoMotor.REST) * ServoMotor.DEGREES;
  }

  /**
   * Resalta el cuerpo del servo.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = ServoMotor.HIGHLIGHT;
    this.body.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Brazo blanco con su buje, que apunta al frente (+z) con el servo a 90°.
   *
   * @param material Plástico blanco.
   */
  private buildArm(material: MeshStandardMaterial): void {
    const { length, width, height, hub } = ServoMotor.ARM;
    const arm = new Mesh(new BoxGeometry(width, height, length), material);
    arm.position.set(0, height / 2, length / 2 - hub);
    const center = new Mesh(new CylinderGeometry(hub, hub, height, GeometryDetail.Low), material);
    center.position.y = height / 2;
    this.horn.add(arm, center);
  }
}
