import { Group, Mesh, type Material, type Object3D, type Scene } from 'three';
import type { ProxyBatch } from './ProxyBatch';
import { ProxyBuilder } from './ProxyBuilder';
import { ProxyCover } from './ProxyCover';
import type { ProxyGroup } from './ProxyGroup';
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
 * Al activarse revisa si algo cambió desde la última vez y rearma solo los grupos afectados (los demás se
 * reutilizan). Durante sus primeros segundos vigila la zona: lo que se mueve solo (un servo) pasa a dibujarse
 * como original, y cuando todo está quieto avisa qué piezas pueden dejar de recalcular sus matrices
 * ({@link SceneProxy.onSettled}). Los subárboles que cubre por completo se ocultan enteros para que three.js ni
 * los recorra.
 */
export class SceneProxy implements Updatable {
  private static readonly REASON = 'proxy';
  private static readonly CHECK_EVERY = 30;
  private static readonly QUIET_CHECKS = 3;

  private readonly group = new Group();
  private readonly keys = new ProxyKey();
  private readonly builder = new ProxyBuilder(this.keys);
  private readonly cover = new ProxyCover();
  private readonly watch = new ProxyWatch();
  private readonly moving = new Set<Object3D>();
  private readonly dropped = new Set<Mesh>();
  private readonly settledListeners: ((still: Object3D[]) => void)[] = [];
  private groups = new Map<string, ProxyGroup>();
  private active = false;
  private built = false;
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
   * Cambia a la versión unida (rearmando los grupos que cambiaron).
   */
  public activate(): void {
    if (this.active) {
      return;
    }
    if (!this.built || this.changed().length > 0) {
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
    this.batches().forEach((batch) => {
      batch.sync();
    });
  }

  /**
   * Libera los lotes.
   */
  public dispose(): void {
    this.reveal();
    this.groups.forEach((group) => {
      SceneProxy.release(group);
    });
    this.groups.clear();
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
      this.drop(changed);
    }
    this.quiet = moved || changed.length > 0 ? 0 : this.quiet + 1;
    if (this.quiet === SceneProxy.QUIET_CHECKS) {
      this.notify(this.watch.still(this.roots));
    }
  }

  /**
   * Saca de los lotes (sin rearmarlos) mallas que se mueven: se apagan sus vértices y vuelven a dibujarse como
   * originales. En el siguiente rearmado ya no entran.
   *
   * @param meshes Mallas que se movieron.
   */
  private drop(meshes: readonly Mesh[]): void {
    this.cover.show();
    meshes.forEach((mesh) => {
      this.moving.add(mesh);
      this.dropped.add(mesh);
      this.batches().forEach((batch) => {
        batch.drop(mesh);
      });
      this.gate.show(mesh, SceneProxy.REASON);
    });
    this.cover.compute(this.roots, new Set(this.live().map(({ mesh }) => mesh)));
    this.cover.hide();
  }

  /**
   * Arma los grupos con el estado actual de las piezas: reutiliza los que no cambiaron y arma los demás.
   */
  private rebuild(): void {
    this.roots.forEach((root) => {
      root.updateMatrixWorld(true);
    });
    const previous = this.groups;
    this.groups = new Map();
    this.collect().forEach(({ kind, meshes }, key) => {
      const old = previous.get(key);
      if (old && this.reusable(old, meshes)) {
        previous.delete(key);
        this.groups.set(key, old);
      } else if (meshes.length > 1) {
        this.groups.set(key, this.builder.build(kind, meshes));
      }
    });
    previous.forEach((group) => {
      SceneProxy.release(group);
    });
    this.mount();
  }

  /**
   * Pone en la escena los lotes vigentes y calcula qué subárboles cubren.
   */
  private mount(): void {
    this.dropped.clear();
    this.group.clear();
    this.batches().forEach((batch) => this.group.add(batch.mesh));
    this.cover.compute(this.roots, new Set(this.sources().map(({ mesh }) => mesh)));
    this.built = true;
  }

  /**
   * Si un grupo ya armado sirve tal cual: las mismas mallas, en el mismo orden, y ninguna cambió.
   *
   * @param group Grupo armado.
   * @param meshes Mallas del grupo ahora.
   * @returns `true` si se puede reutilizar.
   */
  private reusable(group: ProxyGroup, meshes: readonly Mesh[]): boolean {
    const same =
      group.meshes.length === meshes.length && group.meshes.every((mesh, index) => mesh === meshes[index]);
    return same && group.sources.every((source) => !this.differs(source));
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
   * Lotes de todos los grupos.
   *
   * @returns Lotes.
   */
  private batches(): ProxyBatch[] {
    return [...this.groups.values()].flatMap((group) => group.batches);
  }

  /**
   * Mallas originales en los lotes, con su estado copiado.
   *
   * @returns Estados copiados.
   */
  private sources(): ProxySource[] {
    return [...this.groups.values()].flatMap((group) => group.sources);
  }

  /**
   * Mallas originales que siguen dibujándose desde los lotes (sin las que se apagaron por moverse).
   *
   * @returns Estados copiados.
   */
  private live(): ProxySource[] {
    return this.sources().filter(({ mesh }) => !this.dropped.has(mesh));
  }

  /**
   * Mallas originales que se movieron, se ocultaron o cambiaron de material o de textura desde que se armaron
   * sus lotes.
   *
   * @returns Mallas que cambiaron.
   */
  private changed(): Mesh[] {
    return this.live()
      .filter((source) => this.differs(source))
      .map(({ mesh }) => mesh);
  }

  /**
   * Si una malla original ya no está como cuando se copió.
   *
   * @param source Malla con su estado copiado.
   * @returns `true` si cambió.
   */
  private differs(source: ProxySource): boolean {
    const { mesh, matrix, material, map, version, visible } = source;
    const current = mesh.material as Material;
    const texture = ProxyBuilder.mapOf(current);
    if (current !== material || texture !== map || (texture?.version ?? 0) !== version) {
      return true;
    }
    const hid = mesh.visible !== visible && !this.cover.hides(mesh);
    return !mesh.matrixWorld.equals(matrix) || hid;
  }

  /**
   * Saca del render las mallas originales (y oculta los subárboles que los lotes cubren por completo).
   */
  private conceal(): void {
    this.live().forEach(({ mesh }) => {
      this.gate.hide(mesh, SceneProxy.REASON);
    });
    this.cover.hide();
  }

  /**
   * Devuelve al render las mallas originales.
   */
  private reveal(): void {
    this.cover.show();
    this.sources().forEach(({ mesh }) => {
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
   * Libera los lotes de un grupo que ya no se usa.
   *
   * @param group Grupo.
   */
  private static release(group: ProxyGroup): void {
    group.batches.forEach((batch) => {
      batch.dispose();
    });
  }
}
