import {
  BoxGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { BenchCable } from './BenchCable';

/**
 * Lámpara de lupa articulada: prensa al borde del banco, poste, brazo y cabezal con el anillo de luz y el
 * lente. Es la luz principal del taller: encendida ilumina el banco con luz blanca cálida; apagada queda
 * solo el resplandor del tubo del local. El cabezal recibe el clic. Se construye en el espacio del banco.
 */
export class MagnifierLamp {
  private static readonly FINISH = { color: 0x8d949b, roughness: 0.45, metalness: 0.6 };
  private static readonly CLAMP = { width: 0.06, height: 0.05, depth: 0.08 };
  private static readonly POST = { radius: 0.011 };
  private static readonly HEAD = { radius: 0.085, tube: 0.016 };
  private static readonly RING = { color: 0xfff4e2, glow: 2.2, off: 0.05, lift: 0.004 };
  private static readonly LENS = { color: 0xcfe8ff, opacity: 0.18 };
  private static readonly LIGHT = { color: 0xfff1dc, intensity: 3, dim: 0.35, distance: 3.2, drop: 0.05 };
  private static readonly HIT = { radius: 0.11 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new SphereGeometry(MagnifierLamp.HIT.radius, GeometryDetail.Hitbox, GeometryDetail.Hitbox),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly cables = new BenchCable();
  private readonly metal = new MeshStandardMaterial(MagnifierLamp.FINISH);
  private readonly ring = new MeshBasicMaterial({ toneMapped: false });
  private readonly light = new PointLight(MagnifierLamp.LIGHT.color, 0, MagnifierLamp.LIGHT.distance, 2);

  /**
   * Crea la lámpara.
   *
   * @param joints Puntos del banco: la prensa (sobre la cubierta), el codo del poste y el centro del cabezal.
   * @param joints.base Prensa.
   * @param joints.elbow Codo.
   * @param joints.head Cabezal.
   */
  public constructor(private readonly joints: { base: Vector3Like; elbow: Vector3Like; head: Vector3Like }) {}

  /**
   * Construye la prensa, los brazos, el cabezal y la luz.
   *
   * @returns Grupo de la lámpara.
   */
  public build(): Group {
    const { base, elbow, head } = this.joints;
    const { width, height, depth } = MagnifierLamp.CLAMP;
    const clamp = new Mesh(new BoxGeometry(width, height, depth), this.metal);
    clamp.position.set(base.x, base.y + height / 2, base.z);
    this.group.add(clamp);
    const { radius } = MagnifierLamp.POST;
    this.group.add(
      this.cables.rod(base, elbow, radius, this.metal),
      this.cables.rod(elbow, head, radius, this.metal),
    );
    this.buildHead();
    return this.group;
  }

  /**
   * Enciende o apaga el anillo y la luz.
   *
   * @param on Si está encendida.
   * @param level Brillo general (encendido de la escena).
   */
  public apply(on: boolean, level: number): void {
    const { glow, off } = MagnifierLamp.RING;
    const { intensity, dim } = MagnifierLamp.LIGHT;
    this.ring.color.set(MagnifierLamp.RING.color).multiplyScalar(on ? Math.max(level * glow, off) : off);
    this.light.intensity = level * intensity * (on ? 1 : dim);
  }

  /**
   * Resalta el cabezal señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = MagnifierLamp.HIGHLIGHT;
    this.metal.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Cabezal: aro metálico, anillo de luz por debajo, lente, luz y zona de clic.
   */
  private buildHead(): void {
    const { head } = this.joints;
    const { radius, tube } = MagnifierLamp.HEAD;
    const frame = MagnifierLamp.ring(tube, this.metal);
    frame.position.copy(head);
    const glow = MagnifierLamp.ring(tube / 2, this.ring);
    glow.position.set(head.x, head.y - MagnifierLamp.RING.lift, head.z);
    const { color, opacity } = MagnifierLamp.LENS;
    const lens = new Mesh(
      new CircleGeometry(radius, GeometryDetail.Ring),
      new MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false }),
    );
    lens.rotation.x = -Math.PI / 2;
    lens.position.copy(head);
    this.light.position.set(head.x, head.y - MagnifierLamp.LIGHT.drop, head.z);
    this.hitArea.position.copy(head);
    this.group.add(frame, glow, lens, this.light, this.hitArea);
  }

  /**
   * Aro horizontal del tamaño del cabezal.
   *
   * @param tube Grosor del aro.
   * @param material Material.
   * @returns Malla del aro.
   */
  private static ring(tube: number, material: Material): Mesh {
    const { radius } = MagnifierLamp.HEAD;
    const ring = new Mesh(
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Ring),
      material,
    );
    ring.rotation.x = Math.PI / 2;
    return ring;
  }
}
