import { BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';
import type { EnvironmentPanel } from '../models/EnvironmentPanel';
import type { EnvironmentSpec } from '../models/EnvironmentSpec';

/**
 * Escena de referencia para el mapa de entorno: una caja con franjas emisivas alrededor. Se hornea una sola vez
 * (PMREM) y hace que metales, vidrio y charcos reflejen el ambiente sin agregar luces reales. Cada ambiente
 * (la noche de neón, el día) define su caja y sus franjas.
 */
export abstract class EnvironmentRoom {
  private readonly scene = new Scene();

  /**
   * Prepara la escena de referencia.
   *
   * @param spec Caja y franjas.
   */
  protected constructor(private readonly spec: EnvironmentSpec) {}

  /**
   * Construye la escena de referencia.
   *
   * @returns Escena lista para hornear.
   */
  public create(): Scene {
    const { size, color } = this.spec.room;
    const room = new MeshBasicMaterial({ color, side: BackSide });
    this.scene.add(new Mesh(new BoxGeometry(size, size, size), room));
    this.spec.panels.forEach((panel) => {
      this.scene.add(EnvironmentRoom.panel(panel));
    });
    return this.scene;
  }

  /**
   * Libera las geometrías y materiales de la escena de referencia (ya no se necesitan tras hornear).
   */
  public dispose(): void {
    this.scene.traverse((child) => {
      if (child instanceof Mesh) {
        const mesh = child as Mesh<BoxGeometry | PlaneGeometry, MeshBasicMaterial>;
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    });
  }

  /**
   * Franja emisiva mirando hacia el centro.
   *
   * @param panel Color, brillo, tamaño y ubicación.
   * @returns Malla de la franja.
   */
  private static panel(panel: EnvironmentPanel): Mesh {
    const color = new Color(panel.color).multiplyScalar(panel.glow);
    const mesh = new Mesh(new PlaneGeometry(panel.width, panel.height), new MeshBasicMaterial({ color }));
    mesh.position.set(panel.x, panel.y, panel.z);
    mesh.rotation.set(panel.rotationX, panel.rotationY, 0);
    return mesh;
  }
}
