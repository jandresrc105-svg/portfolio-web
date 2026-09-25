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
import type { RenderGate } from './RenderGate';
import type { Updatable } from './Updatable';

/**
 * Descarte de detalles diminutos: una malla que en pantalla mediría menos de un par de píxeles (un tornillo,
 * un cable o una patita vistos desde la vista general) sale del render hasta que la cámara se acerque. Solo
 * se aplica a superficies iluminadas sin brillo propio: lo que emite luz (LEDs, pantallas, neones) se queda,
 * porque aunque sea un punto el bloom lo hace visible. Se saca de la capa de la cámara con la {@link RenderGate}
 * en vez de ocultarla, así no pisa la visibilidad que maneja cada pieza. Una malla unida ({@link GeometryBatcher}) se mide
 * por su parte más grande, así desde lejos desaparece igual que sus partes sueltas. La revisión se reparte:
 * cada frame mide una parte de las mallas (un tercio con la cámara en movimiento, un sexto quieta), así
 * arrastrar la cámara no cuesta una pasada completa por frame; un detalle de un píxel que aparece dos frames
 * tarde no se nota. Lo que ya está fuera del render por otra razón (una malla que se dibuja desde la versión
 * unida de su zona) no se mide: se deja sin descartar, así si vuelve a dibujarse sola (p. ej. porque se movió)
 * aparece en el acto, y lo peor que puede pasar es que un detalle diminuto se vea unos frames de más.
 */
export class DetailCuller implements Updatable {
  private static readonly MIN_PIXELS = 1.2;
  private static readonly SLICES = { moving: 3, still: 6 };
  private static readonly MOVED = 0.01;
  private static readonly REASON = 'tiny';

  private readonly meshes: { mesh: Mesh; radius: number; center: Vector3 }[] = [];
  private readonly world = new Vector3();
  private readonly lastPosition = new Vector3(Infinity, Infinity, Infinity);
  private halfHeight = 1;
  private cursor = 0;

  /**
   * Crea el descarte.
   *
   * @param camera Cámara que mira la escena.
   * @param gate Compuerta de la capa de la cámara (compartida con otras razones para no dibujar algo).
   */
  public constructor(
    private readonly camera: PerspectiveCamera,
    private readonly gate: RenderGate,
  ) {}

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
    const moved = this.camera.position.distanceToSquared(this.lastPosition) > DetailCuller.MOVED ** 2;
    if (moved) {
      this.lastPosition.copy(this.camera.position);
    }
    const { meshes } = this;
    const slices = moved ? DetailCuller.SLICES.moving : DetailCuller.SLICES.still;
    const scale = this.halfHeight / Math.tan(MathUtils.degToRad(this.camera.fov) / 2);
    for (let checked = Math.ceil(meshes.length / slices); checked > 0; checked -= 1) {
      this.cursor = (this.cursor + 1) % meshes.length;
      const entry = meshes[this.cursor];
      if (entry) {
        this.evaluate(entry, scale);
      }
    }
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
    if (this.gate.hiddenBesides(mesh, DetailCuller.REASON) || DetailCuller.glows(mesh.material as Material)) {
      this.gate.show(mesh, DetailCuller.REASON);
      return;
    }
    this.world.copy(center).applyMatrix4(mesh.matrixWorld);
    const distance = Math.max(this.world.distanceTo(this.camera.position), Number.EPSILON);
    const pixels = ((radius * mesh.matrixWorld.getMaxScaleOnAxis()) / distance) * scale;
    if (pixels < DetailCuller.MIN_PIXELS) {
      this.gate.hide(mesh, DetailCuller.REASON);
    } else {
      this.gate.show(mesh, DetailCuller.REASON);
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
