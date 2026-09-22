import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Buzón postal rojo japonés: el punto de contacto.
 */
export class Postbox extends SceneObject {
  private static readonly POSITION = { x: -2.95, y: 0, z: 2.1 };
  private static readonly BODY = { radius: 0.23, height: 1.02 };
  private static readonly SLOT = { width: 0.2, height: 0.035, depth: 0.05, y: 0.82 };
  private static readonly BASE = { radius: 0.27, height: 0.08 };
  private static readonly SEGMENTS = 28;

  /**
   * Crea el buzón.
   *
   * @param materials Materiales compartidos.
   */
  public constructor(private readonly materials: MaterialLibrary) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { radius, height } = Postbox.BODY;
    const { radius: baseRadius, height: baseHeight } = Postbox.BASE;
    const segments = Postbox.SEGMENTS;
    const base = new CylinderGeometry(baseRadius, baseRadius, baseHeight, segments);
    this.part(base, this.materials.ceramic, baseHeight / 2);
    this.part(new CylinderGeometry(radius, radius, height, segments), this.materials.lacquer, height / 2);
    const dome = new SphereGeometry(radius, segments, segments / 2, 0, Math.PI * 2, 0, Math.PI / 2);
    this.part(dome, this.materials.lacquer, height);
    const slot = Postbox.SLOT;
    this.part(new BoxGeometry(slot.width, slot.height, slot.depth), this.materials.ceramic, slot.y, radius);
    this.root.position.copy(Postbox.POSITION);
  }

  /**
   * Agrega una pieza del buzón sobre su eje vertical.
   *
   * @param geometry Geometría de la pieza.
   * @param material Material.
   * @param y Altura del centro.
   * @param z Desplazamiento hacia el frente.
   */
  private part(geometry: BufferGeometry, material: Material, y: number, z = 0): void {
    this.add(new Mesh(geometry, material), { x: 0, y, z });
  }
}
