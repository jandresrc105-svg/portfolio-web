import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { OhmLabArt } from './OhmLabArt';

/**
 * Batería de 9 V de pie con sus broches (+ y −) y, delante, el interruptor de palanca que abre o cierra el
 * circuito, con un LED verde que indica si está cerrado. Batería e interruptor reciben el mismo clic. Se
 * construye en un grupo con origen en la base de la batería, sobre la cubierta del banco.
 */
export class BatteryPack {
  private static readonly CELL = { width: 0.034, height: 0.062, depth: 0.022, color: 0x1a1a1a };
  private static readonly SNAPS = [
    { x: -0.0075, radius: 0.0035, sides: GeometryDetail.Low },
    { x: 0.0075, radius: 0.0045, sides: 6 },
  ];
  private static readonly SNAP = { height: 0.005, color: 0xc0c4c8 };
  private static readonly SWITCH = { width: 0.03, height: 0.012, depth: 0.024, z: 0.07, color: 0x22262b };
  private static readonly LEVER = { radius: 0.0022, length: 0.02, tip: 0.0035, throw: 0.5, color: 0xd9dde2 };
  private static readonly LAMP = { radius: 0.0028, x: 0.0095, z: 0.007, color: 0x3dff7a, glow: 4, off: 0.05 };
  private static readonly HIT = { width: 0.05, height: 0.075, depth: 0.12, z: 0.04 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };
  private static readonly LIFT = 0.0005;
  private static readonly TURN_RATE = 18;

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new BoxGeometry(BatteryPack.HIT.width, BatteryPack.HIT.height, BatteryPack.HIT.depth),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly lever = new Group();
  private readonly base = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 });
  private readonly lamp = new MeshBasicMaterial({ toneMapped: false });
  private closed = true;

  /**
   * Crea la batería.
   *
   * @param art Serigrafías fijas.
   */
  public constructor(private readonly art: OhmLabArt) {}

  /**
   * Construye la batería, sus broches, el interruptor y la zona que recibe el clic.
   *
   * @returns Grupo de la batería.
   */
  public build(): Group {
    this.buildCell();
    this.buildSwitch();
    const hit = BatteryPack.HIT;
    this.hitArea.position.set(0, hit.height / 2, hit.z);
    this.group.add(this.hitArea);
    return this.group;
  }

  /**
   * Punto de conexión en el espacio del grupo: 0 = broche +, 1 = broche −, 2 = entrada del interruptor,
   * 3 = salida del interruptor.
   *
   * @param index Punto.
   * @returns Posición.
   */
  public terminal(index: number): Vector3 {
    const { height } = BatteryPack.CELL;
    const snap = BatteryPack.SNAPS[index];
    if (snap) {
      return new Vector3(snap.x, height + BatteryPack.SNAP.height, 0);
    }
    const toggle = BatteryPack.SWITCH;
    const side = index === 2 ? -1 : 1;
    return new Vector3((side * toggle.width) / 2, toggle.height / 2, toggle.z);
  }

  /**
   * Fija la posición de la palanca y el LED indicador.
   *
   * @param closed Si el circuito está cerrado.
   * @param level Brillo general (encendido de la escena).
   */
  public apply(closed: boolean, level: number): void {
    this.closed = closed;
    const { color, glow, off } = BatteryPack.LAMP;
    this.lamp.color.set(color).multiplyScalar(closed ? Math.max(level * glow, off) : off);
  }

  /**
   * Lleva la palanca a su posición.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const target = (this.closed ? -1 : 1) * BatteryPack.LEVER.throw;
    this.lever.rotation.x +=
      (target - this.lever.rotation.x) * (1 - Math.exp(-BatteryPack.TURN_RATE * delta));
  }

  /**
   * Resalta la batería y el interruptor.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = BatteryPack.HIGHLIGHT;
    this.base.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Batería con su etiqueta al frente y los broches arriba.
   */
  private buildCell(): void {
    const { width, height, depth, color } = BatteryPack.CELL;
    const cell = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 }),
    );
    cell.position.y = height / 2;
    const label = new Mesh(
      new PlaneGeometry(width, height),
      new MeshStandardMaterial({ map: this.art.battery(), roughness: 0.45, envMapIntensity: 0.3 }),
    );
    label.position.set(0, height / 2, depth / 2 + BatteryPack.LIFT);
    this.group.add(cell, label);
    this.buildSnaps(height);
  }

  /**
   * Broches + y − sobre la batería.
   *
   * @param height Alto de la batería.
   */
  private buildSnaps(height: number): void {
    const snap = BatteryPack.SNAP;
    const metal = new MeshStandardMaterial({ color: snap.color, roughness: 0.3, metalness: 0.9 });
    BatteryPack.SNAPS.forEach(({ x, radius, sides }) => {
      const post = new Mesh(new CylinderGeometry(radius, radius, snap.height, sides), metal);
      post.position.set(x, height + snap.height / 2, 0);
      this.group.add(post);
    });
  }

  /**
   * Interruptor de palanca con su LED indicador.
   */
  private buildSwitch(): void {
    const { width, height, depth, z, color } = BatteryPack.SWITCH;
    this.base.color.set(color);
    const block = new Mesh(new BoxGeometry(width, height, depth), this.base);
    block.position.set(0, height / 2, z);
    this.buildLever();
    this.lever.position.set(0, height, z);
    const lamp = BatteryPack.LAMP;
    const dot = new Mesh(
      new SphereGeometry(lamp.radius, GeometryDetail.Thin, GeometryDetail.Thin),
      this.lamp,
    );
    dot.position.set(lamp.x, height, z + lamp.z);
    this.group.add(block, this.lever, dot);
  }

  /**
   * Palanca metálica con su bolita en la punta.
   */
  private buildLever(): void {
    const lever = BatteryPack.LEVER;
    const metal = new MeshStandardMaterial({ color: lever.color, roughness: 0.25, metalness: 0.9 });
    const stick = new Mesh(
      new CylinderGeometry(lever.radius, lever.radius, lever.length, GeometryDetail.Thin),
      metal,
    );
    stick.position.y = lever.length / 2;
    const tip = new Mesh(new SphereGeometry(lever.tip, GeometryDetail.Thin, GeometryDetail.Thin), metal);
    tip.position.y = lever.length;
    this.lever.add(stick, tip);
  }
}
