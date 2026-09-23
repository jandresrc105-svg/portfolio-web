import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  type Material,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Luminarias del techo del local: dos regletas colgadas de varillas, con difusor opalino, y la única luz
 * real del equipo (una `PointLight` bajo el techo) que ilumina el interior. El brillo lo fijan la palanca
 * "Techo" y el dimmer.
 */
export class CeilingFixtures {
  private static readonly ROWS = [{ z: -0.45 }, { z: 0.5 }];
  private static readonly HOUSING = { length: 1.5, height: 0.035, width: 0.11, y: 2.35 };
  private static readonly DIFFUSER = {
    inset: 0.03,
    height: 0.012,
    width: 0.085,
    color: 0xeef6ff,
    glow: 3.2,
    off: 0.04,
  };
  private static readonly ROD = { radius: 0.0035, top: 2.45, spread: 0.6 };
  private static readonly LIGHT = { color: 0xf0f6ff, intensity: 2.4, distance: 3.6, x: 0, y: 2.12, z: 0 };

  public readonly group = new Group();

  private readonly diffuser = new MeshBasicMaterial({ toneMapped: false });
  private readonly light = new PointLight(CeilingFixtures.LIGHT.color, 0, CeilingFixtures.LIGHT.distance, 2);

  /**
   * Crea las luminarias.
   *
   * @param housing Material de la carcasa y las varillas.
   */
  public constructor(private readonly housing: Material) {}

  /**
   * Construye las dos regletas y la luz.
   *
   * @returns Grupo.
   */
  public build(): Group {
    CeilingFixtures.ROWS.forEach(({ z }) => {
      this.buildFixture(z);
    });
    const { x, y, z } = CeilingFixtures.LIGHT;
    this.light.position.set(x, y, z);
    this.group.add(this.light);
    return this.group;
  }

  /**
   * Fija el brillo de los difusores y de la luz.
   *
   * @param level Brillo [0, 1] (palanca × dimmer × arranque × encendido de la escena).
   */
  public apply(level: number): void {
    const { color, glow, off } = CeilingFixtures.DIFFUSER;
    this.diffuser.color.set(color).multiplyScalar(Math.max(level * glow, off));
    this.light.intensity = level * CeilingFixtures.LIGHT.intensity;
  }

  /**
   * Una regleta: carcasa, difusor encendido y dos varillas al techo.
   *
   * @param z Profundidad de la regleta.
   */
  private buildFixture(z: number): void {
    const { length, height, width, y } = CeilingFixtures.HOUSING;
    const body = new Mesh(new BoxGeometry(length, height, width), this.housing);
    body.position.set(0, y, z);
    const lens = CeilingFixtures.DIFFUSER;
    const glow = new Mesh(new BoxGeometry(length - lens.inset, lens.height, lens.width), this.diffuser);
    glow.position.set(0, y - height / 2, z);
    this.group.add(body, glow);
    const { radius, top, spread } = CeilingFixtures.ROD;
    const drop = top - y;
    [-1, 1].forEach((side) => {
      const rod = new Mesh(new CylinderGeometry(radius, radius, drop, GeometryDetail.Wire), this.housing);
      rod.position.set((side * spread) / 2, y + drop / 2, z);
      this.group.add(rod);
    });
  }
}
