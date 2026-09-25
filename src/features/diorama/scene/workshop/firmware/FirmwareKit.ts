import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
  type Object3D,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { DevBoard } from './DevBoard';
import { FirmwareControl } from './FirmwareControl';
import { LedMatrix } from './LedMatrix';
import { ServoMotor } from './ServoMotor';

/**
 * Montaje del laboratorio de firmware sobre la mesa: la protoboard con la placa ESP32, la matriz 8×8 de pie,
 * el buzzer, el potenciómetro y los cables de colores, y el servo al lado. Se construye con origen en el
 * centro de la protoboard, apoyada en la mesa, mirando al frente (+z).
 */
export class FirmwareKit {
  private static readonly BREADBOARD = { width: 0.27, height: 0.01, depth: 0.1, color: 0xebe7dc };
  private static readonly BOARD = { x: -0.072, z: 0.012 };
  private static readonly MATRIX = { x: 0.07, z: -0.03 };
  private static readonly SERVO = { x: 0.2, z: 0 };
  private static readonly BUZZER = { x: 0.03, z: 0.032, radius: 0.011, height: 0.009, color: 0x141416 };
  private static readonly BUZZ = { rate: 90, depth: 0.08 };
  private static readonly POT = { x: 0.1, z: 0.032, base: 0.016, baseHeight: 0.008, color: 0x2a5bd7 };
  private static readonly KNOB = { radius: 0.009, height: 0.012, turn: 2.6, color: 0x1a1c20 };
  private static readonly MARK = { width: 0.0014, height: 0.0008, length: 0.007, color: 0xf2f2f2 };
  private static readonly POT_HIT = { radius: 0.017, height: 0.03 };
  private static readonly WIRE = { radius: 0.0011, arc: 0.022 };
  private static readonly WIRES = [
    { from: { x: -0.03, z: -0.021 }, to: { x: 0.06, z: -0.03 }, color: 0xe8c230 },
    { from: { x: -0.036, z: -0.021 }, to: { x: 0.07, z: -0.03 }, color: 0x2fb34a },
    { from: { x: -0.042, z: -0.021 }, to: { x: 0.08, z: -0.03 }, color: 0xf07a22 },
    { from: { x: -0.06, z: 0.021 }, to: { x: 0.022, z: 0.032 }, color: 0x9b4fd8 },
    { from: { x: -0.054, z: 0.021 }, to: { x: 0.092, z: 0.044 }, color: 0x3f8cff },
    { from: { x: 0.125, z: 0 }, to: { x: 0.18, z: 0 }, color: 0xb0561f },
  ];
  private static readonly WIRE_HEIGHT = { board: 0.027, bench: 0.01 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.45 };

  public readonly group = new Group();

  private readonly board: DevBoard;
  private readonly matrix = new LedMatrix();
  private readonly servo = new ServoMotor();
  private readonly buzzerMaterial = new MeshStandardMaterial({
    color: FirmwareKit.BUZZER.color,
    roughness: 0.6,
  });
  private readonly buzzer: Mesh;
  private readonly knobMaterial = new MeshStandardMaterial({
    color: FirmwareKit.KNOB.color,
    roughness: 0.45,
  });
  private readonly knob = new Group();
  private readonly potArea: Mesh;
  private buzzClock = 0;

  /**
   * Crea el montaje.
   *
   * @param metal Material metálico compartido.
   */
  public constructor(metal: MeshStandardMaterial) {
    this.board = new DevBoard(metal);
    const { radius, height } = FirmwareKit.BUZZER;
    this.buzzer = new Mesh(
      new CylinderGeometry(radius, radius, height, GeometryDetail.Medium),
      this.buzzerMaterial,
    );
    const hit = FirmwareKit.POT_HIT;
    this.potArea = new Mesh(
      new CylinderGeometry(hit.radius, hit.radius, hit.height, GeometryDetail.Hitbox),
      new MeshBasicMaterial({ visible: false }),
    );
  }

  /**
   * Construye el montaje.
   *
   * @param art Serigrafía de la placa y agujeros de la protoboard.
   * @param art.silk Serigrafía.
   * @param art.holes Protoboard.
   * @returns Grupo del montaje.
   */
  public build(art: { silk: Texture; holes: Texture }): Group {
    this.buildBreadboard(art.holes);
    const top = FirmwareKit.BREADBOARD.height;
    this.place(this.board.build(art.silk), { ...FirmwareKit.BOARD, y: top });
    this.place(this.matrix.build(), { ...FirmwareKit.MATRIX, y: top });
    this.place(this.servo.build(), { ...FirmwareKit.SERVO, y: 0 });
    this.buildBuzzer();
    this.buildPot();
    this.buildWires();
    return this.group;
  }

  /**
   * Controles del montaje.
   *
   * @returns Id y zona de clic de cada control.
   */
  public controls(): { id: string; hitArea: Object3D }[] {
    return [
      { id: FirmwareControl.Reset, hitArea: this.board.resetArea },
      { id: FirmwareControl.Pot, hitArea: this.potArea },
      { id: FirmwareControl.Buzzer, hitArea: this.buzzer },
      { id: FirmwareControl.Matrix, hitArea: this.matrix.hitArea },
      { id: FirmwareControl.Servo, hitArea: this.servo.hitArea },
    ];
  }

  /**
   * Punta del conector USB de la placa, en el espacio del montaje.
   *
   * @returns Punto.
   */
  public usbPort(): Vector3 {
    return this.board.usbPort().add(this.board.group.position);
  }

  /**
   * LEDs encendidos en la matriz y ángulo real del servo (para los tooltips).
   *
   * @returns Lecturas.
   */
  public readings(): { lit: number; servo: number } {
    return { lit: this.matrix.lit(), servo: this.servo.degrees };
  }

  /**
   * Muestra el estado de la placa en el montaje.
   *
   * @param view Estado a mostrar.
   * @param view.matrix LEDs de la matriz.
   * @param view.servo Ángulo pedido al servo.
   * @param view.buzzing Si suena el buzzer.
   * @param view.pot Posición del potenciómetro [0, 1].
   * @param view.lights LEDs de la placa.
   * @param view.lights.tx LED de transmisión.
   * @param view.lights.rx LED de recepción.
   * @param view.lights.io2 LED del GPIO2.
   * @param frame Tiempo y brillo.
   * @param frame.delta Segundos desde el frame anterior.
   * @param frame.level Brillo general.
   */
  public show(
    view: {
      matrix: ArrayLike<number>;
      servo: number;
      buzzing: boolean;
      pot: number;
      lights: { tx: boolean; rx: boolean; io2: boolean };
    },
    frame: { delta: number; level: number },
  ): void {
    this.matrix.show(view.matrix, frame.delta, frame.level);
    this.servo.show(view.servo, frame.delta);
    this.board.show(view.lights, frame.level);
    const { turn } = FirmwareKit.KNOB;
    this.knob.rotation.y = turn - view.pot * turn * 2;
    this.buzzClock += frame.delta;
    const { rate, depth } = FirmwareKit.BUZZ;
    this.buzzer.scale.y = view.buzzing ? 1 + Math.sin(this.buzzClock * rate) * depth : 1;
  }

  /**
   * Resalta el control señalado.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    const { color, strength } = FirmwareKit.HIGHLIGHT;
    this.board.highlight(id === FirmwareControl.Reset);
    this.matrix.highlight(id === FirmwareControl.Matrix);
    this.servo.highlight(id === FirmwareControl.Servo);
    this.buzzerMaterial.emissive.set(color).multiplyScalar(id === FirmwareControl.Buzzer ? strength : 0);
    this.knobMaterial.emissive.set(color).multiplyScalar(id === FirmwareControl.Pot ? strength : 0);
  }

  /**
   * Protoboard con sus agujeros.
   *
   * @param holes Textura de los agujeros.
   */
  private buildBreadboard(holes: Texture): void {
    const { width, height, depth, color } = FirmwareKit.BREADBOARD;
    const plastic = new MeshStandardMaterial({ color, roughness: 0.7, envMapIntensity: 0.15 });
    const face = new MeshStandardMaterial({ color, roughness: 0.7, envMapIntensity: 0.15, map: holes });
    const block = new Mesh(new BoxGeometry(width, height, depth), [
      plastic,
      plastic,
      face,
      plastic,
      plastic,
      plastic,
    ]);
    block.position.y = height / 2;
    this.group.add(block);
  }

  /**
   * Buzzer piezoeléctrico (la zona de clic es el mismo cuerpo).
   */
  private buildBuzzer(): void {
    const { x, z, height } = FirmwareKit.BUZZER;
    this.buzzer.position.set(x, FirmwareKit.BREADBOARD.height + height / 2, z);
    this.group.add(this.buzzer);
  }

  /**
   * Potenciómetro: base azul, perilla con su marca y una zona de agarre más grande que la perilla.
   */
  private buildPot(): void {
    const { x, z, base, baseHeight, color } = FirmwareKit.POT;
    const top = FirmwareKit.BREADBOARD.height;
    const body = new Mesh(
      new BoxGeometry(base, baseHeight, base),
      new MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    body.position.set(x, top + baseHeight / 2, z);
    this.buildKnob();
    this.knob.position.set(x, top + baseHeight, z);
    this.potArea.position.set(x, top + FirmwareKit.POT_HIT.height / 2, z);
    this.group.add(body, this.knob, this.potArea);
  }

  /**
   * Perilla del potenciómetro con su marca blanca.
   */
  private buildKnob(): void {
    const knob = FirmwareKit.KNOB;
    const cap = new Mesh(
      new CylinderGeometry(knob.radius, knob.radius, knob.height, GeometryDetail.Medium),
      this.knobMaterial,
    );
    cap.position.y = knob.height / 2;
    const mark = FirmwareKit.MARK;
    const line = new Mesh(
      new BoxGeometry(mark.width, mark.height, mark.length),
      new MeshStandardMaterial({ color: mark.color, roughness: 0.5 }),
    );
    line.position.set(0, knob.height + mark.height / 2, knob.radius - mark.length / 2);
    this.knob.add(cap, line);
  }

  /**
   * Cables de colores de la placa a la matriz (DIN, CLK, CS), al buzzer, al potenciómetro y al servo.
   */
  private buildWires(): void {
    const { radius, arc } = FirmwareKit.WIRE;
    const { board, bench } = FirmwareKit.WIRE_HEIGHT;
    FirmwareKit.WIRES.forEach(({ from, to, color }) => {
      const start = new Vector3(from.x, board, from.z);
      const end = new Vector3(to.x, bench, to.z);
      const middle = start
        .clone()
        .lerp(end, 0.5)
        .setY(board + arc);
      const curve = new QuadraticBezierCurve3(start, middle, end);
      const wire = new Mesh(
        new TubeGeometry(curve, GeometryDetail.Medium, radius, GeometryDetail.Wire),
        new MeshStandardMaterial({ color, roughness: 0.5 }),
      );
      this.group.add(wire);
    });
  }

  /**
   * Ubica una pieza en el montaje.
   *
   * @param object Pieza.
   * @param at Posición.
   * @param at.x Horizontal.
   * @param at.y Altura.
   * @param at.z Profundidad.
   */
  private place(object: Object3D, at: { x: number; y: number; z: number }): void {
    object.position.set(at.x, at.y, at.z);
    this.group.add(object);
  }
}
