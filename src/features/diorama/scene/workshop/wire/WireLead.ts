import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  type MeshStandardMaterial,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { WireStrands } from './WireStrands';

/**
 * Tramo de cable cortado del carrete: el aislante rojo, el trozo de aislante de la punta (que el pelacables
 * empuja hasta sacarlo y cae sobre la mesa) y los hilos de cobre de adentro. El grupo tiene el origen en la
 * punta y el cable sigue hacia +x.
 */
export class WireLead {
  public static readonly RADIUS = 0.007;
  public static readonly STRIP = 0.045;

  private static readonly SLUG = { grow: 1.03, drop: 0.35 };
  private static readonly MIN_LENGTH = 0.002;
  private static readonly HIT = { radius: 0.03, hiddenLayer: 31 };

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new SphereGeometry(WireLead.HIT.radius, GeometryDetail.Hitbox, GeometryDetail.Hitbox),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly strands = new WireStrands(WireLead.STRIP);
  private readonly body: Mesh;
  private readonly slug: Mesh;

  /**
   * Crea el tramo.
   *
   * @param insulation Material rojo del aislante.
   */
  public constructor(insulation: MeshStandardMaterial) {
    const { RADIUS } = WireLead;
    this.body = new Mesh(new CylinderGeometry(RADIUS, RADIUS, 1, GeometryDetail.Medium), insulation);
    const slug = RADIUS * WireLead.SLUG.grow;
    this.slug = new Mesh(new CylinderGeometry(slug, slug, WireLead.STRIP, GeometryDetail.Medium), insulation);
  }

  /**
   * Construye el tramo.
   *
   * @returns Grupo del tramo.
   */
  public build(): Group {
    this.body.rotation.z = Math.PI / 2;
    this.slug.rotation.z = Math.PI / 2;
    this.hitArea.position.x = WireLead.STRIP / 2;
    this.group.add(this.body, this.slug, this.strands.mesh, this.hitArea);
    return this.group;
  }

  /**
   * Ubica la punta y fija cuánto cable hay (mientras sale del carrete el tramo se alarga).
   *
   * @param tip Punta del cable.
   * @param length Largo total del tramo; 0 lo oculta.
   */
  public extend(tip: Vector3Like, length: number): void {
    this.group.position.copy(tip);
    this.group.visible = length > WireLead.MIN_LENGTH;
    const body = Math.max(length - WireLead.STRIP, WireLead.MIN_LENGTH);
    this.body.scale.y = body;
    this.body.position.x = WireLead.STRIP + body / 2;
  }

  /**
   * Mueve el trozo de aislante de la punta: empujado por el pelacables o caído sobre la mesa.
   *
   * @param offset Cuánto lo empujó el pelacables hacia la punta.
   * @param dropped Punto de la mesa donde quedó tirado (relativo a la punta), o `null` si sigue en el cable.
   */
  public slide(offset: number, dropped: Vector3Like | null): void {
    if (dropped) {
      this.slug.position.copy(dropped);
      this.slug.rotation.set(0, WireLead.SLUG.drop, Math.PI / 2);
      return;
    }
    this.slug.position.set(WireLead.STRIP / 2 - offset, 0, 0);
    this.slug.rotation.set(0, 0, Math.PI / 2);
  }

  /**
   * Da forma a los hilos de la punta.
   *
   * @param look Apertura, torsión, estañado y si faltan hilos.
   * @param look.fan Apertura en abanico (0…1).
   * @param look.twist Torsión (0…1).
   * @param look.tin Estañado (0…1).
   * @param look.cut Si faltan hilos.
   */
  public shape(look: { fan: number; twist: number; tin: number; cut: boolean }): void {
    this.strands.shape(look);
  }

  /**
   * Deja la punta al alcance del puntero o la saca del rayo (para que, oculta, no tape el carrete).
   *
   * @param pickable Si recibe el puntero.
   */
  public setPickable(pickable: boolean): void {
    this.hitArea.layers.set(pickable ? 0 : WireLead.HIT.hiddenLayer);
  }

  /**
   * Resalta la punta señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    this.strands.highlight(active);
  }
}
