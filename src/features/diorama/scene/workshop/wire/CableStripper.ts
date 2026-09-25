import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Pelacables: cabezal de acero con las cuchillas (el cable pasa por la muesca), el perno del eje y dos mangos
 * con empuñaduras rojas. Descansa sobre la mesa y, al tomarlo, muerde el aislante junto a la punta y se desliza
 * hacia ella llevándose el aislante. El grupo tiene el origen en la muesca; los mangos van hacia +z.
 */
export class CableStripper {
  private static readonly HEAD = { width: 0.018, height: 0.03, depth: 0.024, notch: 0.009, color: 0x9ba3ab };
  private static readonly PIVOT = { radius: 0.005, length: 0.022, z: 0.006, color: 0x3a3f45 };
  private static readonly HANDLE = { width: 0.01, height: 0.006, length: 0.13, gap: 0.007, open: 0.07 };
  private static readonly GRIP = { width: 0.014, height: 0.011, length: 0.08, color: 0xd23b2b };
  private static readonly REST = { x: 0.98, y: 0.913, z: 0.3, turn: 0.75, roll: Math.PI / 2 };
  private static readonly WORK = { tilt: -0.35 };
  private static readonly HIT = { width: 0.05, height: 0.05, depth: 0.2 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };
  private static readonly RATE = 14;

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new BoxGeometry(CableStripper.HIT.width, CableStripper.HIT.height, CableStripper.HIT.depth),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly steel = new MeshStandardMaterial({
    color: CableStripper.HEAD.color,
    roughness: 0.3,
    metalness: 0.85,
    envMapIntensity: 0.6,
  });
  private readonly grip = new MeshStandardMaterial({
    color: CableStripper.GRIP.color,
    roughness: 0.6,
    envMapIntensity: 0.3,
  });
  private readonly target = new Vector3(CableStripper.REST.x, CableStripper.REST.y, CableStripper.REST.z);
  private work = 0;

  /**
   * Construye el cabezal y los mangos, y lo deja en reposo sobre la mesa.
   *
   * @returns Grupo del pelacables.
   */
  public build(): Group {
    const { depth } = CableStripper.HEAD;
    this.buildJaws();
    const { radius, length, z, color } = CableStripper.PIVOT;
    const pivot = new Mesh(
      new CylinderGeometry(radius, radius, length, GeometryDetail.Low),
      new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.7 }),
    );
    pivot.rotation.z = Math.PI / 2;
    pivot.position.z = depth / 2 + z;
    this.buildHandles();
    this.hitArea.position.z = CableStripper.HIT.depth / 2 - CableStripper.HEAD.depth;
    this.group.add(pivot, this.hitArea);
    this.group.position.copy(this.target);
    this.pose(0);
    return this.group;
  }

  /**
   * Lleva el pelacables hacia su sitio: en reposo sobre la mesa, o mordiendo el cable en un punto.
   *
   * @param delta Segundos desde el frame anterior.
   * @param bite Punto del cable donde muerde, o `null` para dejarlo en la mesa.
   */
  public update(delta: number, bite: Vector3 | null): void {
    const { x, y, z } = CableStripper.REST;
    this.target.set(x, y, z);
    if (bite) {
      this.target.copy(bite);
    }
    const blend = 1 - Math.exp(-CableStripper.RATE * delta);
    this.group.position.lerp(this.target, bite && this.work > 0.5 ? 1 : blend);
    this.work += ((bite ? 1 : 0) - this.work) * blend;
    this.pose(this.work);
  }

  /**
   * Resalta el pelacables señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = CableStripper.HIGHLIGHT;
    this.steel.emissive.set(color).multiplyScalar(active ? strength : 0);
    this.grip.emissive.set(color).multiplyScalar(active ? strength / 2 : 0);
  }

  /**
   * Orientación entre reposo (acostado de lado y girado sobre la mesa) y trabajo (mangos hacia la calle).
   *
   * @param work 0 = reposo, 1 = trabajando.
   */
  private pose(work: number): void {
    const { turn, roll } = CableStripper.REST;
    this.group.rotation.set(CableStripper.WORK.tilt * work, turn * (1 - work), roll * (1 - work), 'YXZ');
  }

  /**
   * Las dos cuchillas del cabezal, con la muesca por donde pasa el cable.
   */
  private buildJaws(): void {
    const { width, height, depth, notch } = CableStripper.HEAD;
    const jaw = (height - notch) / 2;
    [-1, 1].forEach((side) => {
      const blade = new Mesh(new BoxGeometry(width, jaw, depth), this.steel);
      blade.position.y = side * (notch + jaw) * 0.5;
      this.group.add(blade);
    });
  }

  /**
   * Mangos abiertos en V con sus empuñaduras.
   */
  private buildHandles(): void {
    const { width, height, length, gap, open } = CableStripper.HANDLE;
    const grip = CableStripper.GRIP;
    const start = CableStripper.HEAD.depth / 2;
    [-1, 1].forEach((side) => {
      const arm = new Group();
      arm.position.set(0, side * gap, start);
      arm.rotation.x = -side * open;
      const bar = new Mesh(new BoxGeometry(width, height, length), this.steel);
      bar.position.z = length / 2;
      const sleeve = new Mesh(new BoxGeometry(grip.width, grip.height, grip.length), this.grip);
      sleeve.position.z = length - grip.length / 2;
      arm.add(bar, sleeve);
      this.group.add(arm);
    });
  }
}
