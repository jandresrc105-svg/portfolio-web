import { Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Intersection, type Raycaster } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Zona de clic invisible de la bola de plasma que además recuerda dónde la tocó el último rayo del puntero
 * (el selector del taller la prueba en cada frame), para que los filamentos se junten en ese punto.
 */
export class PlasmaHitArea extends Mesh {
  /** Último punto de la escena donde el rayo del puntero tocó la zona. */
  public readonly point = new Vector3();

  /**
   * Crea la zona.
   *
   * @param radius Radio de la esfera.
   */
  public constructor(radius: number) {
    super(
      new SphereGeometry(radius, GeometryDetail.Hitbox, GeometryDetail.Hitbox),
      new MeshBasicMaterial({ visible: false }),
    );
  }

  /**
   * Prueba el rayo como cualquier malla y guarda el punto de impacto.
   *
   * @param raycaster Rayo del puntero.
   * @param intersects Lista de impactos donde se agrega el de la zona.
   */
  public override raycast(raycaster: Raycaster, intersects: Intersection[]): void {
    const before = intersects.length;
    super.raycast(raycaster, intersects);
    const hit = intersects[before];
    if (hit) {
      this.point.copy(hit.point);
    }
  }
}
