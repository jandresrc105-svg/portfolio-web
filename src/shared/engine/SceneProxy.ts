import { Group, Mesh, type Material, type Object3D, type Scene } from 'three';
import type { ProxyBatch } from './ProxyBatch';
import { ProxyBuilder } from './ProxyBuilder';
import { ProxyCover } from './ProxyCover';
import type { ProxyGroup } from './ProxyGroup';
import { ProxyKey } from './ProxyKey';
import { ProxyRig } from './ProxyRig';
import type { ProxyKind } from './ProxyKind';
import type { ProxySource } from './ProxySource';
import { ProxyWatch } from './ProxyWatch';
import type { RenderGate } from './RenderGate';
import type { Updatable } from './Updatable';

/**
 * Versión unida de una zona de la escena (patrón Proxy): sus mallas originales dejan de dibujarse y en su
 * lugar se dibujan unos pocos lotes con las mismas geometrías, en el mismo lugar y con los mismos materiales.
 * Las piezas originales siguen vivas (se animan, sus luces iluminan) y cada frame los lotes copian sus colores y
 * brillos, así un LED que parpadea o una luz que se enciende se ven igual.
 *
 * Cada frame revisa además si alguna malla copiada se movió, se ocultó, cambió de material o redibujó su
 * textura: esa malla se apaga en su lote y vuelve a dibujarse como original en el mismo frame (o el siguiente,
 * si fue un movimiento), así lo que el visitante toca o lo que se anima nunca se ve congelado. Al cambiar de
 * parada ({@link SceneProxy.refresh}) se rearman solo los grupos donde algo cambió; lo que se mueve una y otra
 * vez (un servo) queda como original para siempre. Lo que no se puede unir sin cambiar el resultado
 * (transparencias, shaders propios, instancias, lo que se refleja en los charcos) se dibuja siempre como
 * original. Los subárboles que cubre por completo se ocultan enteros para que three.js ni los recorra, y avisa
 * qué piezas quedaron quietas ({@link SceneProxy.onSettled}) para congelar sus matrices.
 */
export class SceneProxy implements Updatable {
  private static readonly REASON = 'proxy';
  private static readonly CHECK_EVERY = 30;
  private static readonly QUIET_CHECKS = 3;
  private static readonly RESTLESS_DROPS = 2;
  private static readonly RIGID = 'rigid';
  private static readonly REFRESH_DELAY = 90;

  private readonly group = new Group();
  private readonly keys: ProxyKey;
  private readonly builder: ProxyBuilder;
  private readonly cover = new ProxyCover();
  private readonly watch = new ProxyWatch();
  private readonly moving = new Set<Object3D>();
  private readonly drops = new Map<Mesh, number>();
  private readonly moves = new Map<Mesh, number>();
  private readonly restless = new Set<Mesh>();
  private readonly rig = new ProxyRig();
  private readonly dropped = new Set<Mesh>();
  private readonly changed: Mesh[] = [];
  private readonly settledListeners: ((still: Object3D[]) => void)[] = [];
  private groups = new Map<string, ProxyGroup>();
  private sources: ProxySource[] = [];
  private batches: ProxyBatch[] = [];
  private active = false;
  private built = false;
  private frame = 0;
  private quiet = 0;
  private stride = 1;
  private refreshAt = 0;

  /**
   * Prepara la versión unida (sin armarla todavía).
   *
   * @param scene Escena donde se dibujan los lotes.
   * @param roots Raíces de las piezas de la zona.
   * @param gate Compuerta de la capa de la cámara.
   */
  public constructor(
    scene: Scene,
    private readonly roots: readonly Object3D[],
    private readonly gate: RenderGate,
  ) {
    this.keys = new ProxyKey(gate);
    this.builder = new ProxyBuilder(this.keys);
    this.group.name = 'SceneProxy';
    this.group.matrixAutoUpdate = false;
    this.group.visible = false;
    scene.add(this.group);
  }

  /**
   * Avisa cuando la zona quedó quieta (con las piezas que pueden dejar de recalcular matrices) y cuando la
   * versión unida se desactiva o se rearma (con una lista vacía).
   *
   * @param listener Recibe las raíces quietas.
   */
  public onSettled(listener: (still: Object3D[]) => void): void {
    this.settledListeners.push(listener);
  }

  /**
   * Cada cuántos frames se revisa cada malla: 1 en la zona que se está usando (lo que se toca responde en el
   * mismo frame) y más en las demás, donde casi nada cambia y basta con repartir la revisión.
   *
   * @param frames Frames entre revisiones de una misma malla.
   */
  public setStride(frames: number): void {
    this.stride = Math.max(1, Math.floor(frames));
  }

  /**
   * Cambia a la versión unida (rearmando los grupos que cambiaron).
   */
  public activate(): void {
    if (this.active) {
      return;
    }
    if (!this.built || this.hasChanges()) {
      this.rebuild();
    }
    this.conceal();
    this.group.visible = true;
    this.active = true;
    this.restartWatch();
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
   * Vuelve a meter en los lotes lo que se sacó porque cambió (si ya está quieto), rearmando solo esos grupos.
   */
  public refresh(): void {
    if (!this.active || (this.dropped.size === 0 && !this.hasChanges())) {
      return;
    }
    this.reveal();
    this.rebuild();
    this.conceal();
    this.restartWatch();
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    if (!this.active) {
      return;
    }
    this.detect();
    const share = { every: this.stride, turn: this.frame };
    this.batches.forEach((batch) => {
      batch.sync(false, share);
    });
    this.frame += 1;
    if (this.refreshAt > 0 && this.frame >= this.refreshAt) {
      this.refreshAt = 0;
      this.refresh();
    }
    if (this.quiet < SceneProxy.QUIET_CHECKS && this.frame % SceneProxy.CHECK_EVERY === 0) {
      this.settle();
    }
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
   * Saca de los lotes lo que cambió desde que se copió (revisa la parte de las mallas que toca en este frame).
   */
  private detect(): void {
    const { sources, stride, changed } = this;
    for (let index = this.frame % stride; index < sources.length; index += stride) {
      const source = sources[index];
      if (source && !this.dropped.has(source.mesh)) {
        this.inspect(source);
      }
    }
    if (changed.length > 0) {
      this.drop(changed);
      changed.length = 0;
    }
  }

  /**
   * Revisa una malla copiada y, si cambió, la anota para sacarla del lote.
   *
   * @param source Malla con su estado copiado.
   */
  private inspect(source: ProxySource): void {
    const change = this.change(source);
    if (change !== null) {
      this.count(source.mesh, change);
      this.changed.push(source.mesh);
    }
  }

  /**
   * Cuenta los cambios de una malla. La que se mueve una y otra vez pasa a un lote articulado en el próximo
   * rearmado (que se pide solo, al rato); la que cambia de material o de visibilidad una y otra vez, o se mueve
   * con una escala que no se puede articular, queda original.
   *
   * @param mesh Malla.
   * @param change Qué cambió.
   */
  private count(mesh: Mesh, change: 'moved' | 'changed'): void {
    const tally = change === 'moved' ? this.moves : this.drops;
    const times = (tally.get(mesh) ?? 0) + 1;
    tally.set(mesh, times);
    if (times < SceneProxy.RESTLESS_DROPS || this.restless.has(mesh)) {
      return;
    }
    if (change === 'moved' && this.rig.fits(mesh)) {
      this.restless.add(mesh);
      this.refreshAt = this.frame + SceneProxy.REFRESH_DELAY;
    } else {
      this.moving.add(mesh);
    }
  }

  /**
   * Cuenta revisiones sin movimiento en la zona y, tras varias, avisa qué piezas quedaron quietas.
   */
  private settle(): void {
    this.quiet = this.watch.check() ? 0 : this.quiet + 1;
    if (this.quiet === SceneProxy.QUIET_CHECKS) {
      this.notify(this.watch.still(this.roots));
    }
  }

  /**
   * Vuelve a vigilar la zona desde cero (después de activarla o rearmarla).
   */
  private restartWatch(): void {
    this.quiet = 0;
    this.watch.start(this.roots);
    this.notify([]);
  }

  /**
   * Saca de los lotes (sin rearmarlos) mallas que cambiaron: se apagan sus vértices y vuelven a dibujarse como
   * originales hasta el próximo rearmado.
   *
   * @param meshes Mallas que cambiaron.
   */
  private drop(meshes: readonly Mesh[]): void {
    this.cover.show();
    meshes.forEach((mesh) => {
      this.dropped.add(mesh);
      this.batches.forEach((batch) => {
        batch.drop(mesh);
      });
      this.gate.show(mesh, SceneProxy.REASON);
    });
    this.cover.compute(this.roots, this.proxied());
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
    this.collect().forEach(({ kind, meshes, rigid }, key) => {
      const old = previous.get(key);
      if (old && this.reusable(old, meshes)) {
        previous.delete(key);
        this.groups.set(key, old);
      } else if (meshes.length > 1) {
        this.groups.set(key, this.builder.build(kind, meshes, rigid));
      }
    });
    previous.forEach((group) => {
      SceneProxy.release(group);
    });
    this.mount();
  }

  /**
   * Pone en la escena los lotes vigentes, guarda las listas de lotes y mallas, y calcula qué subárboles cubren.
   */
  private mount(): void {
    const groups = [...this.groups.values()];
    this.batches = groups.flatMap((group) => group.batches);
    this.sources = groups.flatMap((group) => group.sources);
    this.dropped.clear();
    this.group.clear();
    this.batches.forEach((batch) => this.group.add(batch.mesh));
    this.cover.compute(this.roots, this.proxied());
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
    return (
      same && group.sources.every((source) => !this.dropped.has(source.mesh) && this.change(source) === null)
    );
  }

  /**
   * Junta las mallas visibles de la zona que se pueden unir, agrupadas por clave.
   *
   * @returns Grupos.
   */
  private collect(): Map<string, { kind: ProxyKind; meshes: Mesh[]; rigid: boolean }> {
    const groups = new Map<string, { kind: ProxyKind; meshes: Mesh[]; rigid: boolean }>();
    const visit = (node: Object3D): void => {
      if (!node.visible || this.moving.has(node)) {
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
  private sort(mesh: Mesh, groups: Map<string, { kind: ProxyKind; meshes: Mesh[]; rigid: boolean }>): void {
    const kind = this.keys.kind(mesh);
    if (!kind) {
      return;
    }
    const rigid = this.restless.has(mesh);
    const key = rigid ? `${SceneProxy.RIGID}|${this.keys.of(mesh, kind)}` : this.keys.of(mesh, kind);
    const group = groups.get(key) ?? { kind, meshes: [], rigid };
    group.meshes.push(mesh);
    groups.set(key, group);
  }

  /**
   * Mallas que se dibujan desde los lotes ahora (sin las apagadas).
   *
   * @returns Mallas.
   */
  private proxied(): Set<Object3D> {
    return new Set(this.sources.filter(({ mesh }) => !this.dropped.has(mesh)).map(({ mesh }) => mesh));
  }

  /**
   * Si alguna malla copiada (sin contar las ya apagadas) cambió.
   *
   * @returns `true` si hay cambios.
   */
  private hasChanges(): boolean {
    return this.sources.some((source) => !this.dropped.has(source.mesh) && this.change(source) !== null);
  }

  /**
   * Qué cambió de una malla original desde que se copió: `'changed'` si cambió de material, de textura o de
   * visibilidad, `'moved'` si solo se movió (en un lote articulado moverse no cuenta) y `null` si nada.
   *
   * @param source Malla con su estado copiado.
   * @returns Qué cambió.
   */
  private change(source: ProxySource): 'moved' | 'changed' | null {
    if (this.replaced(source)) {
      return 'changed';
    }
    return !source.rigid && !source.mesh.matrixWorld.equals(source.matrix) ? 'moved' : null;
  }

  /**
   * Si una malla original cambió de material, redibujó su textura o cambió de visibilidad (sin contar lo que
   * ocultó la cubierta).
   *
   * @param source Malla con su estado copiado.
   * @returns `true` si cambió.
   */
  private replaced(source: ProxySource): boolean {
    const { mesh, material, map, version, visible } = source;
    const current = mesh.material as Material;
    const texture = ProxyBuilder.mapOf(current);
    if (current !== material || texture !== map || (texture?.version ?? 0) !== version) {
      return true;
    }
    return mesh.visible !== visible && !this.cover.hides(mesh);
  }

  /**
   * Saca del render las mallas originales que están en los lotes (y oculta los subárboles cubiertos).
   */
  private conceal(): void {
    this.sources.forEach(({ mesh }) => {
      if (!this.dropped.has(mesh)) {
        this.gate.hide(mesh, SceneProxy.REASON);
      }
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
   * @param still Raíces quietas (vacío mientras se vigila de nuevo).
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
