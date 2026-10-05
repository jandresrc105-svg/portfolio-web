import { CylinderGeometry, Mesh } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Taburete del taller junto a la punta de la mesa de los cables, donde Juan se sienta a trabajar de día. Igual
 * a los de la barra, pero más bajo, a la altura de una mesa de trabajo.
 */
export class WorkStool extends SceneObject {
  private static readonly STOOL = { radius: 0.17, seat: 0.035, leg: 0.035, height: 0.6, x: 1.62, z: 0.1 };

  /**
   * Crea el taburete.
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
    const { radius, seat, leg, height, x, z } = WorkStool.STOOL;
    const post = new CylinderGeometry(leg, leg, height, GeometryDetail.Low);
    this.add(new Mesh(post, this.materials.darkMetal), { x, y: height / 2, z });
    const top = new CylinderGeometry(radius, radius, seat, GeometryDetail.Medium);
    this.add(new Mesh(top, this.materials.lacquer), { x, y: height + seat / 2, z });
    new WorkshopLayout().place(this.root);
  }
}
