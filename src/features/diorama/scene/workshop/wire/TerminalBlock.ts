import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Bornera de tornillo de dos vías: cuerpo verde, las bocas del frente, un tornillo por vía y un LED de
 * continuidad. La segunda vía ya tiene su cable negro, que baja por detrás de la mesa. Al conectar, el tornillo
 * de la primera vía gira y baja apretando el cable, y el LED se prende en verde. El grupo tiene el origen en el
 * centro de la base; la boca de la primera vía mira hacia +x.
 */
export class TerminalBlock {
  public static readonly WIDTH = 0.08;
  public static readonly WAY = 0.02;

  private static readonly BODY = { height: 0.034, depth: 0.09, color: 0x2f7d4f };
  private static readonly OTHER = -0.025;
  private static readonly HOLE = { size: 0.013, depth: 0.004, color: 0x0b0d0f };
  private static readonly SCREW = { radius: 0.0085, height: 0.004, slot: 0.0016, turns: 3, sink: 0.0015 };
  private static readonly METAL = { color: 0xc8ccd0 };
  private static readonly LED = {
    radius: 0.004,
    height: 0.005,
    x: -0.028,
    z: 0.03,
    color: 0x39ff6a,
    glow: 6,
  };
  private static readonly LED_OFF = { color: 0x0f3a1c, level: 0.35 };
  private static readonly BLACK = { color: 0x16181b, reach: 0.05, drop: 0.2, bend: 0.05 };
  private static readonly HIT = { grow: 1.3 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.3 };

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly body = new MeshStandardMaterial({
    color: TerminalBlock.BODY.color,
    roughness: 0.55,
    envMapIntensity: 0.3,
  });
  private readonly led = new MeshBasicMaterial({ toneMapped: false });
  private readonly screws: Group[] = [];
  private readonly lit = new Color(TerminalBlock.LED.color);

  /**
   * Crea la bornera.
   *
   * @param wireRadius Radio del cable (altura del centro de las bocas).
   */
  public constructor(private readonly wireRadius: number) {
    const { height, depth } = TerminalBlock.BODY;
    const { grow } = TerminalBlock.HIT;
    this.hitArea = new Mesh(
      new BoxGeometry(TerminalBlock.WIDTH * grow, height * grow, depth * grow),
      new MeshBasicMaterial({ visible: false }),
    );
  }

  /**
   * Construye el cuerpo, las bocas, los tornillos, el LED y el cable de la otra vía.
   *
   * @returns Grupo de la bornera.
   */
  public build(): Group {
    const { height, depth } = TerminalBlock.BODY;
    const body = new Mesh(new BoxGeometry(TerminalBlock.WIDTH, height, depth), this.body);
    body.position.y = height / 2;
    this.hitArea.position.y = height / 2;
    const metal = new MeshStandardMaterial({ ...TerminalBlock.METAL, roughness: 0.3, metalness: 0.9 });
    [TerminalBlock.WAY, TerminalBlock.OTHER].forEach((z) => {
      this.buildWay(z, metal);
    });
    const { radius, height: tall, x, z } = TerminalBlock.LED;
    const led = new Mesh(new CylinderGeometry(radius, radius, tall, GeometryDetail.Low), this.led);
    led.position.set(x, height + tall / 2, z);
    this.group.add(body, led, this.hitArea, this.buildReturn());
    this.show(0, 0, 1);
    return this.group;
  }

  /**
   * Gira el tornillo de la primera vía y prende el LED.
   *
   * @param screw Avance del apriete (0…1).
   * @param led Encendido del LED (0…1).
   * @param level Brillo general (encendido de la escena).
   */
  public show(screw: number, led: number, level: number): void {
    const head = this.screws[0];
    if (head) {
      const { turns, sink } = TerminalBlock.SCREW;
      head.rotation.y = -screw * turns * Math.PI * 2;
      head.position.y = TerminalBlock.BODY.height - screw * sink;
    }
    const on = TerminalBlock.LED;
    const off = TerminalBlock.LED_OFF;
    this.led.color.set(off.color).multiplyScalar(off.level);
    this.lit.set(on.color).multiplyScalar(on.glow * level);
    this.led.color.lerp(this.lit, led);
  }

  /**
   * Resalta la bornera señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    const { color, strength } = TerminalBlock.HIGHLIGHT;
    this.body.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Una vía: su boca al frente y su tornillo arriba.
   *
   * @param z Posición de la vía.
   * @param metal Material de los tornillos.
   */
  private buildWay(z: number, metal: MeshStandardMaterial): void {
    const { size, depth, color } = TerminalBlock.HOLE;
    const hole = new Mesh(new BoxGeometry(depth, size, size), new MeshBasicMaterial({ color }));
    hole.position.set(TerminalBlock.WIDTH / 2, this.wireRadius, z);
    const { radius, height, slot } = TerminalBlock.SCREW;
    const head = new Group();
    const disc = new Mesh(new CylinderGeometry(radius, radius, height, GeometryDetail.Low), metal);
    disc.position.y = height / 2;
    const cut = new Mesh(new BoxGeometry(radius * 2, slot, slot), new MeshBasicMaterial({ color }));
    cut.position.y = height;
    head.add(disc, cut);
    head.position.set(0, TerminalBlock.BODY.height, z);
    this.screws.push(head);
    this.group.add(hole, head);
  }

  /**
   * Cable negro de la segunda vía: sale por la boca y cae por el borde de la mesa.
   *
   * @returns Malla del cable.
   */
  private buildReturn(): Mesh {
    const { color, reach, drop, bend } = TerminalBlock.BLACK;
    const edge = TerminalBlock.WIDTH / 2;
    const y = this.wireRadius;
    const z = TerminalBlock.OTHER;
    const curve = new CatmullRomCurve3([
      new Vector3(edge, y, z),
      new Vector3(edge + reach / 2, y, z - reach / 2),
      new Vector3(edge, y, z - reach),
      new Vector3(-edge, y, z - reach),
      new Vector3(-edge - reach / 2, -bend, z - reach),
      new Vector3(-edge - reach / 2, -drop, z - reach),
    ]);
    const tube = new TubeGeometry(curve, GeometryDetail.Curve, y, GeometryDetail.Low);
    return new Mesh(tube, new MeshStandardMaterial({ color, roughness: 0.45, envMapIntensity: 0.3 }));
  }
}
