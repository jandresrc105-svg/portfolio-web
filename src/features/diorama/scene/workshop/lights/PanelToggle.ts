import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Material,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SmoothLevel } from './SmoothLevel';

/**
 * Una fila del tablero de interruptores: palanca de bat cromada sobre su escudo (arriba = encendido) y el
 * LED piloto verde de su circuito. Toda la fila recibe el puntero. Se construye con la cara del tablero en
 * z = 0 mirando hacia +z.
 */
export class PanelToggle {
  private static readonly PLATE = { width: 0.046, height: 0.06, depth: 0.01 };
  private static readonly LEVER = { radius: 0.0055, tip: 0.0085, length: 0.042, tilt: 0.55, rate: 18 };
  private static readonly LEVER_FINISH = {
    color: 0xd4d9e0,
    roughness: 0.28,
    metalness: 0.9,
    envMapIntensity: 0.6,
  };
  private static readonly LED = {
    radius: 0.0075,
    bezel: 0.0105,
    ring: 0.0025,
    color: 0x3dff6e,
    glow: 4,
    off: 0.04,
  };
  private static readonly X = { lever: -0.105, led: 0.125 };
  private static readonly HIT = { width: 0.32, height: 0.08, depth: 0.05 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new BoxGeometry(PanelToggle.HIT.width, PanelToggle.HIT.height, PanelToggle.HIT.depth),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly pivot = new Group();
  private readonly lever = new MeshStandardMaterial(PanelToggle.LEVER_FINISH);
  private readonly led = new MeshBasicMaterial({ toneMapped: false });
  private readonly position = new SmoothLevel(1, PanelToggle.LEVER.rate);

  /**
   * Crea la fila.
   *
   * @param y Altura de la fila en el tablero.
   * @param materials Materiales del escudo y del bisel del LED.
   * @param materials.plate Metal del escudo.
   * @param materials.bezel Metal del bisel.
   */
  public constructor(
    private readonly y: number,
    private readonly materials: { plate: Material; bezel: Material },
  ) {}

  /**
   * Construye el escudo, la palanca, el LED y la zona de clic.
   *
   * @returns Grupo de la fila.
   */
  public build(): Group {
    const { width, height, depth } = PanelToggle.PLATE;
    const plate = new Mesh(new BoxGeometry(width, height, depth), this.materials.plate);
    plate.position.set(PanelToggle.X.lever, this.y, depth / 2);
    this.pivot.position.set(PanelToggle.X.lever, this.y, depth);
    this.pivot.add(this.buildLever());
    this.hitArea.position.set(0, this.y, PanelToggle.HIT.depth / 2);
    this.group.add(plate, this.pivot, this.buildLed(), this.hitArea);
    return this.group;
  }

  /**
   * Mueve la palanca hacia su posición.
   *
   * @param on Si el circuito está encendido (palanca arriba).
   */
  public setOn(on: boolean): void {
    this.position.set(on ? 1 : 0);
  }

  /**
   * Anima la palanca y enciende el LED piloto.
   *
   * @param delta Segundos desde el frame anterior.
   * @param level Brillo general (encendido de la escena).
   */
  public update(delta: number, level: number): void {
    const up = this.position.step(delta);
    this.pivot.rotation.x = (1 - 2 * up) * PanelToggle.LEVER.tilt;
    const { color, glow, off } = PanelToggle.LED;
    this.led.color.set(color).multiplyScalar(Math.max(up * level * glow, off));
  }

  /**
   * Resalta la palanca señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    const { color, strength } = PanelToggle.HIGHLIGHT;
    this.lever.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Palanca de bat: varilla hacia +z con la bolita en la punta.
   *
   * @returns Grupo de la palanca (gira con el pivote).
   */
  private buildLever(): Group {
    const { radius, tip, length } = PanelToggle.LEVER;
    const rod = new Mesh(new CylinderGeometry(radius * 0.5, radius, length, GeometryDetail.Low), this.lever);
    rod.rotation.x = Math.PI / 2;
    rod.position.z = length / 2;
    const ball = new Mesh(new SphereGeometry(tip, GeometryDetail.Low, GeometryDetail.Thin), this.lever);
    ball.position.z = length;
    const group = new Group();
    group.add(rod, ball);
    return group;
  }

  /**
   * LED piloto con su bisel metálico.
   *
   * @returns Grupo del LED.
   */
  private buildLed(): Group {
    const { radius, bezel, ring } = PanelToggle.LED;
    const bulb = new Mesh(new SphereGeometry(radius, GeometryDetail.Low, GeometryDetail.Thin), this.led);
    const frame = new Mesh(
      new TorusGeometry(bezel, ring, GeometryDetail.Thin, GeometryDetail.Medium),
      this.materials.bezel,
    );
    const group = new Group();
    group.add(bulb, frame);
    group.position.set(PanelToggle.X.led, this.y, 0);
    return group;
  }
}
