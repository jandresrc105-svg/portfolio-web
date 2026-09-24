import {
  BatchedMesh,
  Color,
  Frustum,
  Matrix4,
  MeshBasicMaterial,
  Sphere,
  Vector4,
  type BufferGeometry,
  type Camera,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import { HotspotMarker } from './HotspotMarker';

/**
 * Dibujo conjunto de los marcadores (patrón Flyweight): los rombos y anillos de todos los marcadores van en una
 * sola malla por lotes, con la pose y la opacidad de cada uno por instancia, así cuestan un dibujo en vez de
 * dos por marcador. Cada marcador sigue siendo su propia pieza (animación, encendido, zona de clic); aquí solo
 * se copia su estado en cada frame y se descartan los que no están en cámara (si no queda ninguno, la malla ni
 * se dibuja). Va primero entre las transparencias: con opacidad completa se ve como una pieza opaca, igual que
 * cuando cada marcador se ordenaba por su distancia, y no se refleja en los charcos (solo está en la capa de
 * la cámara).
 */
export class HotspotMarkers extends SceneObject implements Updatable {
  private static readonly COLOR = 0x5ee7ff;
  private static readonly GLOW = 4;
  private static readonly RENDER_ORDER = -1;
  private static readonly PARTS = 2;

  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly sphere = new Sphere();
  private readonly gem = new Matrix4();
  private readonly ring = new Matrix4();
  private readonly tint = new Vector4(1, 1, 1, 1);
  private readonly levels: number[];
  private readonly batch: BatchedMesh;
  private readonly slots: { gem: number; ring: number }[] = [];

  /**
   * Prepara el dibujo conjunto.
   *
   * @param markers Marcadores que dibuja (ya construidos o no: se leen en cada frame).
   * @param camera Cámara principal, para descartar los marcadores que no ve.
   */
  public constructor(
    private readonly markers: readonly HotspotMarker[],
    private readonly camera: Camera,
  ) {
    super();
    this.levels = markers.map(() => -1);
    this.batch = HotspotMarkers.createBatch(markers.length);
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    this.camera.updateMatrixWorld();
    this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    let shown = false;
    this.markers.forEach((marker, index) => {
      shown = this.copy(marker, index) || shown;
    });
    this.batch.visible = shown;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { gem, ring } = HotspotMarker.shapes();
    HotspotMarkers.index(gem);
    const shapes = { gem: this.batch.addGeometry(gem), ring: this.batch.addGeometry(ring) };
    this.tint.w = 0;
    this.markers.forEach(() => {
      const slot = { gem: this.batch.addInstance(shapes.gem), ring: this.batch.addInstance(shapes.ring) };
      this.batch.setColorAt(slot.gem, this.tint);
      this.batch.setColorAt(slot.ring, this.tint);
      this.slots.push(slot);
    });
    gem.dispose();
    ring.dispose();
    this.add(this.batch);
  }

  /**
   * Copia al lote la pose y la opacidad de un marcador, o lo oculta si está apagado o fuera de cámara.
   *
   * @param marker Marcador.
   * @param index Posición del marcador (y de sus instancias).
   * @returns `true` si se dibuja.
   */
  private copy(marker: HotspotMarker, index: number): boolean {
    const slot = this.slots[index];
    if (!slot) {
      return false;
    }
    const level = marker.level;
    const shown = level > 0 && this.frustum.intersectsSphere(marker.bounds(this.sphere));
    this.batch.setVisibleAt(slot.gem, shown);
    this.batch.setVisibleAt(slot.ring, shown);
    if (!shown) {
      return false;
    }
    marker.pose(this.gem, this.ring);
    this.batch.setMatrixAt(slot.gem, this.gem);
    this.batch.setMatrixAt(slot.ring, this.ring);
    this.fade(slot, level, index);
    return true;
  }

  /**
   * Pone la opacidad de un marcador en sus dos instancias, solo si cambió.
   *
   * @param slot Instancias del marcador.
   * @param slot.gem Instancia del rombo.
   * @param slot.ring Instancia del anillo.
   * @param level Opacidad.
   * @param index Posición del marcador.
   */
  private fade(slot: { gem: number; ring: number }, level: number, index: number): void {
    if (this.levels[index] === level) {
      return;
    }
    this.levels[index] = level;
    this.tint.w = level;
    this.batch.setColorAt(slot.gem, this.tint);
    this.batch.setColorAt(slot.ring, this.tint);
  }

  /**
   * Malla por lotes con capacidad para el rombo y el anillo de cada marcador.
   *
   * @param count Cantidad de marcadores.
   * @returns Malla vacía, sin recorte propio (lo hace {@link HotspotMarkers.update}).
   */
  private static createBatch(count: number): BatchedMesh {
    const { gem, ring } = HotspotMarker.shapes();
    const vertices = gem.getAttribute('position').count + ring.getAttribute('position').count;
    const indices = gem.getAttribute('position').count + (ring.index?.count ?? 0);
    gem.dispose();
    ring.dispose();
    const color = new Color(HotspotMarkers.COLOR).multiplyScalar(HotspotMarkers.GLOW);
    const material = new MeshBasicMaterial({ color, transparent: true });
    const batch = new BatchedMesh(count * HotspotMarkers.PARTS, vertices, indices, material);
    batch.perObjectFrustumCulled = false;
    batch.sortObjects = true;
    batch.frustumCulled = false;
    batch.renderOrder = HotspotMarkers.RENDER_ORDER;
    return batch;
  }

  /**
   * Agrega un índice trivial a una geometría sin índice (el lote exige que todas lo tengan o ninguna).
   *
   * @param geometry Geometría.
   */
  private static index(geometry: BufferGeometry): void {
    if (!geometry.index) {
      const count = geometry.getAttribute('position').count;
      geometry.setIndex(Array.from({ length: count }, (_, vertex) => vertex));
    }
  }
}
