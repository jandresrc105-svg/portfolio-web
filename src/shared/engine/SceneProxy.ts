import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  type Scene,
  type Texture,
} from 'three';
import { ProxyBatch } from './ProxyBatch';
import { ProxyCover } from './ProxyCover';
import { ProxyKey } from './ProxyKey';
import type { ProxyKind } from './ProxyKind';
import type { ProxySource } from './ProxySource';
import { ProxyWatch } from './ProxyWatch';
import type { RenderGate } from './RenderGate';
import type { Updatable } from './Updatable';

/**
 * Versión unida de una zona de la escena (patrón Proxy): mientras la zona se ve de lejos y nadie la usa, sus
 * mallas originales dejan de dibujarse y en su lugar se dibujan unos pocos lotes con las mismas geometrías,
 * en el mismo lugar y con los mismos materiales. Las piezas originales siguen vivas (se animan, sus luces
 * iluminan) y cada frame los lotes copian sus colores y brillos, así un LED que parpadea o una luz que se
 * enciende se ven igual. Lo que no se puede unir sin cambiar el resultado (transparencias, shaders propios,
 * instancias, lo que se refleja en los charcos) y lo que se mueve (`keep`) sigue dibujándose como siempre.
 *
 * Al activarse revisa si algo cambió desde la última vez y, si es así, se rearma. Durante sus primeros segundos
 * vigila la zona: lo que se mueve solo (un servo) pasa a dibujarse como original, y cuando todo está quieto
 * avisa qué piezas pueden dejar de recalcular sus matrices ({@link SceneProxy.onSettled}). Los subárboles que
 * cubre por completo se ocultan enteros para que three.js ni los recorra.
 */
export class SceneProxy implements Updatable {
  private static readonly REASON = 'proxy';
  private static readonly CHECK_EVERY = 30;
  private static readonly QUIET_CHECKS = 3;

  private readonly group = new Group();
  private readonly keys = new ProxyKey();
  private readonly cover = new ProxyCover();
  private readonly watch = new ProxyWatch();
  private readonly moving = new Set<Object3D>();
  private readonly settledListeners: ((still: Object3D[]) => void)[] = [];
  private batches: ProxyBatch[] = [];
  private sources: ProxySource[] = [];
  private active = false;
  private frame = 0;
  private quiet = 0;

  /**
   * Prepara la versión unida (sin armarla todavía).
   *
   * @param scene Escena donde se dibujan los lotes.
   * @param roots Raíces de las piezas de la zona.
   * @param keep Nodos que siempre se dibujan como originales (partes que se mueven).
   * @param gate Compuerta de la capa de la cámara.
   */
  public constructor(
    scene: Scene,
    private readonly roots: readonly Object3D[],
    private readonly keep: readonly Object3D[],
    private readonly gate: RenderGate,
  ) {
    this.group.name = 'SceneProxy';
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    scene.add(this.group);
  }

  /**
   * Avisa cuando la zona quedó quieta (con las piezas que pueden dejar de recalcular matrices) y cuando la
   * versión unida se desactiva (con una lista vacía).
   *
   * @param listener Recibe las raíces quietas.
   */
  public onSettled(listener: (still: Object3D[]) => void): void {
    this.settledListeners.push(listener);
  }

  /**
   * Cambia a la versión unida (rearmándola si algo cambió).
   */
  public activate(): void {
    if (this.active) {
      return;
    }
    if (this.batches.length === 0 || this.changed().length > 0) {
      this.rebuild();
    }
    this.conceal();
    this.group.visible = true;
    this.active = true;
    this.quiet = 0;
    this.watch.start(this.roots);
  }

  /**
   * Vuelve a dibujar las mallas originales.
   */
  public deactivate(): void {
    if (!this.active) {
      return;
    }
    this.reveal();
    this.group.visible = false;
    this.active = false;
    this.notify([]);
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    if (!this.active) {
      return;
    }
    this.frame += 1;
    if (this.quiet < SceneProxy.QUIET_CHECKS && this.frame % SceneProxy.CHECK_EVERY === 0) {
      this.learn();
    }
    this.batches.forEach((batch) => {
      batch.sync();
    });
  }

  /**
   * Libera los lotes.
   */
  public dispose(): void {
    this.reveal();
    this.clear();
    this.group.removeFromParent();
  }

  /**
   * Revisa la zona durante los primeros segundos: lo que cambió solo se mueve de verdad y pasa a dibujarse
   * como original; tras varias revisiones sin movimiento, avisa que la zona está quieta.
   */
  private learn(): void {
    const changed = this.changed();
    const moved = this.watch.check();
    if (changed.length > 0) {
      changed.forEach((mesh) => this.moving.add(mesh));
      this.reveal();
      this.rebuild();
      this.conceal();
    }
    this.quiet = moved || changed.length > 0 ? 0 : this.quiet + 1;
    if (this.quiet === SceneProxy.QUIET_CHECKS) {
      this.notify(this.watch.still(this.roots));
    }
  }

  /**
   * Arma los lotes con el estado actual de las piezas y calcula qué subárboles cubren.
   */
  private rebuild(): void {
    this.clear();
    this.roots.forEach((root) => {
      root.updateMatrixWorld(true);
    });
    this.collect().forEach(({ kind, meshes }) => {
      this.add(kind, meshes);
    });
    this.cover.compute(this.roots, new Set(this.sources.map(({ mesh }) => mesh)));
  }

  /**
   * Agrega un lote (si tiene más de una malla, si no no gana nada) y guarda cómo estaban sus originales.
   *
   * @param kind Tipo de lote.
   * @param meshes Mallas originales.
   */
  private add(kind: ProxyKind, meshes: Mesh[]): void {
    if (meshes.length < 2) {
      return;
    }
    try {
      const batch = new ProxyBatch(kind, meshes);
      this.batches.push(batch);
      this.group.add(batch.mesh);
      meshes.forEach((mesh) => {
        const material = mesh.material as Material;
        const map = SceneProxy.mapOf(material);
        this.sources.push({ mesh, matrix: mesh.matrixWorld.clone(), material, map, visible: mesh.visible });
      });
    } catch {
      return;
    }
  }

  /**
   * Junta las mallas visibles de la zona que se pueden unir, agrupadas por clave.
   *
   * @returns Grupos.
   */
  private collect(): Map<string, { kind: ProxyKind; meshes: Mesh[] }> {
    const groups = new Map<string, { kind: ProxyKind; meshes: Mesh[] }>();
    const keep = new Set(this.keep);
    const visit = (node: Object3D): void => {
      if (!node.visible || keep.has(node) || this.moving.has(node)) {
        return;
      }
      if (node instanceof Mesh) {
        this.sort(node as Mesh, groups);
      }
      node.children.forEach(visit);
    };
    this.roots.forEach(visit);
    return groups;
  }

  /**
   * Pone una malla en el grupo de su clave, si se puede unir.
   *
   * @param mesh Malla.
   * @param groups Grupos por clave.
   */
  private sort(mesh: Mesh, groups: Map<string, { kind: ProxyKind; meshes: Mesh[] }>): void {
    const kind = this.keys.kind(mesh);
    if (!kind) {
      return;
    }
    const key = this.keys.of(mesh, kind);
    const group = groups.get(key) ?? { kind, meshes: [] };
    group.meshes.push(mesh);
    groups.set(key, group);
  }

  /**
   * Mallas originales que se movieron, se ocultaron o cambiaron de material o de textura desde que se armaron
   * los lotes.
   *
   * @returns Mallas que cambiaron.
   */
  private changed(): Mesh[] {
    return this.sources.filter((source) => this.differs(source)).map(({ mesh }) => mesh);
  }

  /**
   * Si una malla original ya no está como cuando se copió.
   *
   * @param source Malla con su estado copiado.
   * @returns `true` si cambió.
   */
  private differs(source: ProxySource): boolean {
    const { mesh, matrix, material, map, visible } = source;
    const current = mesh.material as Material;
    if (current !== material || SceneProxy.mapOf(current) !== map) {
      return true;
    }
    const hid = mesh.visible !== visible && !this.cover.hides(mesh);
    return !mesh.matrixWorld.equals(matrix) || hid;
  }

  /**
   * Saca del render las mallas originales (y oculta los subárboles que los lotes cubren por completo).
   */
  private conceal(): void {
    this.sources.forEach(({ mesh }) => {
      this.gate.hide(mesh, SceneProxy.REASON);
    });
    this.cover.hide();
  }

  /**
   * Devuelve al render las mallas originales.
   */
  private reveal(): void {
    this.cover.show();
    this.sources.forEach(({ mesh }) => {
      this.gate.show(mesh, SceneProxy.REASON);
    });
  }

  /**
   * Avisa a quien escuche qué piezas están quietas.
   *
   * @param still Raíces quietas (vacío al desactivarse).
   */
  private notify(still: Object3D[]): void {
    this.settledListeners.forEach((listener) => {
      listener(still);
    });
  }

  /**
   * Quita los lotes actuales.
   */
  private clear(): void {
    this.batches.forEach((batch) => {
      batch.dispose();
    });
    this.batches = [];
    this.sources = [];
    this.group.clear();
  }

  /**
   * Textura de color de un material (si tiene).
   *
   * @param material Material.
   * @returns Textura o `null`.
   */
  private static mapOf(material: Material): Texture | null {
    return material instanceof MeshStandardMaterial || material instanceof MeshBasicMaterial
      ? material.map
      : null;
  }
}
