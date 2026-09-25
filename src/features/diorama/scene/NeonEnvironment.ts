import { BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry, Scene } from 'three';

/**
 * Escena de referencia para el mapa de entorno: una caja nocturna con franjas emisivas del color de los
 * neones, los faroles y la luna. Se hornea una sola vez (PMREM) y hace que metales, vidrio y charcos
 * reflejen la ciudad sin agregar luces reales.
 */
export class NeonEnvironment {
  private static readonly ROOM = { size: 20, color: 0x07060e };
  private static readonly PANELS = [
    { color: 0xff2d78, glow: 1.8, width: 9, height: 1.6, x: 0, y: 5, z: -9, rotationY: 0, rotationX: 0 },
    {
      color: 0x3fd8ff,
      glow: 4,
      width: 6,
      height: 1.2,
      x: 9,
      y: 3,
      z: 1,
      rotationY: -Math.PI / 2,
      rotationX: 0,
    },
    {
      color: 0xff8a3d,
      glow: 1.8,
      width: 5,
      height: 2,
      x: -9,
      y: 2.5,
      z: -1,
      rotationY: Math.PI / 2,
      rotationX: 0,
    },
    {
      color: 0x7d95ff,
      glow: 1.4,
      width: 14,
      height: 14,
      x: 0,
      y: 9.5,
      z: 0,
      rotationY: 0,
      rotationX: Math.PI / 2,
    },
    {
      color: 0xff5aa8,
      glow: 0.6,
      width: 10,
      height: 1.5,
      x: 0,
      y: 2,
      z: 9,
      rotationY: Math.PI,
      rotationX: 0,
    },
  ];

  private readonly scene = new Scene();

  /**
   * Construye la escena de referencia.
   *
   * @returns Escena lista para hornear.
   */
  public create(): Scene {
    const { size, color } = NeonEnvironment.ROOM;
    const room = new MeshBasicMaterial({ color, side: BackSide });
    this.scene.add(new Mesh(new BoxGeometry(size, size, size), room));
    NeonEnvironment.PANELS.forEach((panel) => {
      this.scene.add(NeonEnvironment.panel(panel));
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
  private static panel(panel: (typeof NeonEnvironment.PANELS)[number]): Mesh {
    const color = new Color(panel.color).multiplyScalar(panel.glow);
    const mesh = new Mesh(new PlaneGeometry(panel.width, panel.height), new MeshBasicMaterial({ color }));
    mesh.position.set(panel.x, panel.y, panel.z);
    mesh.rotation.set(panel.rotationX, panel.rotationY, 0);
    return mesh;
  }
}
