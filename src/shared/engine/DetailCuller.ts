import {
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Sphere,
  Vector3,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { GeometryBatcher } from './GeometryBatcher';
import type { Updatable } from './Updatable';

/**
 * Descarte de detalles diminutos: una malla que en pantalla mediría menos de un par de píxeles (un tornillo,
 * un cable o una patita vistos desde la vista general) sale del render hasta que la cámara se acerque. Solo
 * se aplica a superficies iluminadas sin brillo propio: lo que emite luz (LEDs, pantallas, neones) se queda,
 * porque aunque sea un punto el bloom lo hace visible. Se saca de la capa 0 (la de la cámara) en vez de
 * ocultarla, así no pisa la visibilidad que maneja cada pieza. Una malla unida ({@link GeometryBatcher}) se mide
 * por su parte más grande, así desde lejos desaparece igual que sus partes sueltas.
 */
export class DetailCuller implements Updatable {
  private static readonly MIN_PIXELS = 1.2;
  private static readonly EVERY = 6;
  private static readonly MOVED = 0.01;
  private static readonly CAMERA_LAYER = 0;

  private readonly meshes: { mesh: Mesh; radius: number; center: Vector3 }[] = [];
  private readonly world = new Vector3();
  private readonly lastPosition = new Vector3(Infinity, Infinity, Infinity);
  private halfHeight = 1;
  private frame = 0;

  /**
   * Crea el descarte.
   *
   * @param camera Cámara que mira la escena.
   */
  public constructor(private readonly camera: PerspectiveCamera) {}

  /**
   * Revisa las mallas de una pieza y guarda las que se pueden descartar.
   *
   * @param root Raíz de la pieza.
   */
  public track(root: Object3D): void {
    root.traverse((object) => {
      const mesh = object instanceof Mesh ? (object as Mesh) : null;
      if (!mesh || !DetailCuller.cullable(mesh)) {
        return;
      }
      mesh.geometry.computeBoundingSphere();
      const sphere = mesh.geometry.boundingSphere ?? new Sphere();
      const radius = GeometryBatcher.detailOf(mesh) ?? sphere.radius;
      this.meshes.push({ mesh, radius, center: sphere.center.clone() });
    });
  }

  /**
   * Alto del render en píxeles, para medir los detalles en pantalla.
   *
   * @param height Alto en píxeles del buffer de dibujo.
   */
  public setViewport(height: number): void {
    this.halfHeight = height / 2;
    this.lastPosition.set(Infinity, Infinity, Infinity);
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    this.frame += 1;
    const moved = this.camera.position.distanceToSquared(this.lastPosition) > DetailCuller.MOVED ** 2;
    if (!moved && this.frame % DetailCuller.EVERY !== 0) {
      return;
    }
    this.lastPosition.copy(this.camera.position);
    const scale = this.halfHeight / Math.tan(MathUtils.degToRad(this.camera.fov) / 2);
    this.meshes.forEach((entry) => {
      this.evaluate(entry, scale);
    });
  }

  /**
   * Mete o saca una malla del render según su tamaño en pantalla.
   *
   * @param entry Malla con su esfera local.
   * @param entry.mesh Malla.
   * @param entry.radius Radio local.
   * @param entry.center Centro local.
   * @param scale Píxeles por unidad a distancia 1.
   */
  private evaluate(entry: { mesh: Mesh; radius: number; center: Vector3 }, scale: number): void {
    const { mesh, radius, center } = entry;
    if (DetailCuller.glows(mesh.material as Material)) {
      mesh.layers.enable(DetailCuller.CAMERA_LAYER);
      return;
    }
    this.world.copy(center).applyMatrix4(mesh.matrixWorld);
    const distance = Math.max(this.world.distanceTo(this.camera.position), Number.EPSILON);
    const pixels = ((radius * mesh.matrixWorld.getMaxScaleOnAxis()) / distance) * scale;
    if (pixels < DetailCuller.MIN_PIXELS) {
      mesh.layers.disable(DetailCuller.CAMERA_LAYER);
    } else {
      mesh.layers.enable(DetailCuller.CAMERA_LAYER);
    }
  }

  /**
   * Si una malla se puede descartar: visible, no instanciada, con un solo material iluminado estándar.
   *
   * @param mesh Malla.
   * @returns `true` si se puede descartar.
   */
  private static cullable(mesh: Mesh): boolean {
    if (mesh instanceof InstancedMesh || !mesh.visible || Array.isArray(mesh.material)) {
      return false;
    }
    return mesh.material instanceof MeshStandardMaterial;
  }

  /**
   * Si un material brilla por sí mismo en este momento (un LED encendido, p. ej.): se revisa en cada pasada
   * porque el brillo cambia con el encendido.
   *
   * @param material Material.
   * @returns `true` si hay que dejarlo siempre.
   */
  private static glows(material: Material): boolean {
    if (!(material instanceof MeshStandardMaterial)) {
      return true;
    }
    return material.emissiveIntensity > 0 && material.emissive.getHex() !== 0;
  }
}
