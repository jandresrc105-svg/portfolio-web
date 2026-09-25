import { Group, Mesh, SkinnedMesh, type Object3D, type Scene } from 'three';
import type { ProxyBatch } from './ProxyBatch';
import { ProxyBuilder } from './ProxyBuilder';
import { ProxyCover } from './ProxyCover';
import type { ProxyGroup } from './ProxyGroup';
import { ProxyKey } from './ProxyKey';
import { ProxyMotion } from './ProxyMotion';
import { ProxyRig } from './ProxyRig';
import type { ProxyKind } from './ProxyKind';
import type { ProxyPart } from './ProxyPart';
import { ProxyParts } from './ProxyParts';
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
 * qué piezas quedaron quietas ({@link SceneProxy.onSettled}) para congelar sus matrices. Una malla con varios
 * materiales entra grupo por grupo ({@link ProxyParts}), cada grupo en el lote de su material, pero entra
 * entera o no entra: si a una de sus partes le falta con quién unirse, se queda original.
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
  private readonly parts = new ProxyParts();
  private readonly cover = new ProxyCover();
  private readonly watch = new ProxyWatch();
  private readonly motion = new ProxyMotion();
  private readonly flagged = new Set<Mesh>();
  private readonly moving = new Set<Object3D>();
  private readonly drops = new Map<Mesh, number>();
  private readonly moves = new Map<Mesh, number>();
  private readonly restless = new Set<Mesh>();
  private readonly rig = new ProxyRig();
  private readonly dropped = new Set<Mesh>();
  private readonly changed: Mesh[] = [];
  private readonly share = { every: 1, turn: 0 };
  private readonly settledListeners: ((still: Object3D[]) => void)[] = [];
  private readonly builtListeners: ((meshes: readonly Object3D[]) => void)[] = [];
  private groups = new Map<string, ProxyGroup>();
  private sources: ProxySource[] = [];
  private batches: ProxyBatch[] = [];
  private active = false;
  private built = false;
  private frame = 0;
  private checks = 0;
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
   * Avisa qué piezas de la zona quedaron quietas (las que pueden dejar de recalcular matrices; de nuevo cada
   * vez que una empieza a moverse) y cuando la versión unida se desactiva o se rearma (con una lista vacía).
   *
   * @param listener Recibe las raíces quietas.
   */
  public onSettled(listener: (still: Object3D[]) => void): void {
    this.settledListeners.push(listener);
  }

  /**
   * Avisa cada vez que se arman lotes nuevos (con sus mallas), antes de liberar los que reemplazan.
   *
   * @param listener Recibe las mallas de los lotes nuevos.
   */
  public onBuilt(listener: (meshes: readonly Object3D[]) => void): void {
    this.builtListeners.push(listener);
  }

  /**
   * Copias articuladas (sin dibujar) de los lotes actuales, para compilar de antemano la variante con
   * skinning de sus shaders: lo que se mueve una y otra vez pasa después a un lote articulado con materiales
   * iguales, y compilar esa variante recién entonces trababa la animación unos 200 ms.
   *
   * @returns Mallas articuladas que comparten geometría y material con los lotes.
   */
  public rigVariants(): Object3D[] {
    return this.batches
      .filter((batch) => !(batch.mesh instanceof SkinnedMesh))
      .map((batch) => new SkinnedMesh(batch.mesh.geometry, batch.mesh.material));
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
    const share = this.share;
    share.every = this.stride;
    share.turn = this.frame;
    for (const batch of this.batches) {
      batch.sync(false, share);
    }
    this.frame += 1;
    if (this.refreshAt > 0 && this.frame >= this.refreshAt) {
      this.refreshAt = 0;
      this.refresh();
    }
    if (this.frame % SceneProxy.CHECK_EVERY === 0) {
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
   * Saca de los lotes lo que cambió desde que se copió: revisa material, textura y visibilidad de la parte de
   * las mallas que toca en este frame, y la posición de las que cuelgan de algo que se recompuso
   * ({@link ProxyMotion}).
   */
  private detect(): void {
    const { sources, stride, changed, dropped } = this;
    for (let index = this.frame % stride; index < sources.length; index += stride) {
      const source = sources[index];
      if (source && !dropped.has(source.mesh) && this.replaced(source)) {
        this.flag(source.mesh, 'changed');
      }
    }
    this.flagMoved();
    if (changed.length > 0) {
      this.drop(changed);
      changed.length = 0;
      this.flagged.clear();
    }
  }

  /**
   * Anota las mallas copiadas que se movieron (según lo que se recompuso) y que no se anotaron ya.
   */
  private flagMoved(): void {
    const { dropped, flagged } = this;
    for (const { mesh } of this.motion.moved(dropped, flagged)) {
      if (!flagged.has(mesh)) {
        this.flag(mesh, 'moved');
      }
    }
  }

  /**
   * Anota una malla que cambió para sacarla del lote.
   *
   * @param mesh Malla.
   * @param change Qué cambió.
   */
  private flag(mesh: Mesh, change: 'moved' | 'changed'): void {
    this.count(mesh, change);
    this.changed.push(mesh);
    this.flagged.add(mesh);
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
   * Revisa qué piezas se movieron: tras unas cuantas revisiones avisa cuáles quedaron quietas (aunque otras
   * sigan moviéndose) y, desde entonces, vuelve a avisar cada vez que una de ellas empieza a moverse.
   */
  private settle(): void {
    const restless = this.watch.check();
    this.checks += 1;
    if (this.checks === SceneProxy.QUIET_CHECKS || (this.checks > SceneProxy.QUIET_CHECKS && restless)) {
      this.notify(this.watch.still(this.roots));
    }
  }

  /**
   * Vuelve a vigilar la zona desde cero (después de activarla o rearmarla).
   */
  private restartWatch(): void {
    this.checks = 0;
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
    const built = this.regroup(previous);
    this.mount();
    this.announce(built);
    previous.forEach((group) => {
      SceneProxy.release(group);
    });
  }

  /**
   * Arma los grupos vigentes: reutiliza los que no cambiaron (y los saca de `previous`) y arma los demás.
   *
   * @param previous Grupos anteriores; al terminar quedan solo los que hay que liberar.
   * @returns Grupos armados de nuevo.
   */
  private regroup(previous: Map<string, ProxyGroup>): ProxyGroup[] {
    const built: ProxyGroup[] = [];
    this.collect().forEach(({ kind, parts, rigid }, key) => {
      const old = previous.get(key);
      if (old && this.reusable(old, parts)) {
        previous.delete(key);
        this.groups.set(key, old);
      } else if (parts.length > 1) {
        const group = this.builder.build(kind, parts, rigid);
        this.groups.set(key, group);
        built.push(group);
      }
    });
    return built;
  }

  /**
   * Avisa los lotes recién armados. Va antes de liberar los viejos: si sus shaders se preparan mientras los
   * materiales viejos (con la misma clave) siguen vivos, three.js reutiliza los programas en vez de borrarlos y
   * volver a compilarlos al dibujar.
   *
   * @param built Grupos nuevos.
   */
  private announce(built: readonly ProxyGroup[]): void {
    const meshes = built.flatMap((group) => group.batches.map((batch) => batch.mesh));
    if (meshes.length === 0) {
      return;
    }
    this.builtListeners.forEach((listener) => {
      listener(meshes);
    });
  }

  /**
   * Pone en la escena los lotes vigentes, guarda las listas de lotes y mallas, y calcula qué subárboles cubren.
   */
  private mount(): void {
    const groups = [...this.groups.values()];
    this.batches = groups.flatMap((group) => group.batches);
    this.sources = groups.flatMap((group) => group.sources);
    this.dropped.clear();
    this.orphans().forEach((mesh) => {
      this.dropped.add(mesh);
      this.batches.forEach((batch) => {
        batch.drop(mesh);
      });
    });
    this.motion.watch(this.sources);
    this.group.clear();
    this.batches.forEach((batch) => this.group.add(batch.mesh));
    this.cover.compute(this.roots, this.proxied());
    this.built = true;
  }

  /**
   * Mallas con varios materiales a las que les quedó alguna parte fuera de los lotes (un lote que no se pudo
   * armar): se dibujan como originales, porque sacar la malla del render sacaría también esa parte.
   *
   * @returns Mallas incompletas.
   */
  private orphans(): Mesh[] {
    const counts = new Map<Mesh, number>();
    this.sources.forEach(({ mesh, slot }) => {
      if (slot >= 0) {
        counts.set(mesh, (counts.get(mesh) ?? 0) + 1);
      }
    });
    return [...counts].filter(([mesh, count]) => count < mesh.geometry.groups.length).map(([mesh]) => mesh);
  }

  /**
   * Si un grupo ya armado sirve tal cual: las mismas partes, en el mismo orden, y ninguna cambió.
   *
   * @param group Grupo armado.
   * @param parts Partes del grupo ahora.
   * @returns `true` si se puede reutilizar.
   */
  private reusable(group: ProxyGroup, parts: readonly ProxyPart[]): boolean {
    const same =
      group.parts.length === parts.length &&
      group.parts.every((part, index) => {
        const other = parts[index];
        return part.mesh === other?.mesh && part.slot === other.slot;
      });
    return (
      same && group.sources.every((source) => !this.dropped.has(source.mesh) && this.change(source) === null)
    );
  }

  /**
   * Junta las partes de las mallas visibles de la zona que se pueden unir, agrupadas por clave (sin las mallas
   * con varios materiales que no entran enteras).
   *
   * @returns Grupos.
   */
  private collect(): Map<string, { kind: ProxyKind; parts: ProxyPart[]; rigid: boolean }> {
    const groups = new Map<string, { kind: ProxyKind; parts: ProxyPart[]; rigid: boolean }>();
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
    SceneProxy.prune(groups);
    return groups;
  }

  /**
   * Pone las partes de una malla en el grupo de su clave, si todas se pueden unir.
   *
   * @param mesh Malla.
   * @param groups Grupos por clave.
   */
  private sort(
    mesh: Mesh,
    groups: Map<string, { kind: ProxyKind; parts: ProxyPart[]; rigid: boolean }>,
  ): void {
    const parts = this.parts.of(mesh) ?? [];
    const kinds = parts.map((part) => this.keys.kind(part));
    if (parts.length === 0 || kinds.includes(null)) {
      return;
    }
    const rigid = this.restless.has(mesh);
    parts.forEach((part, index) => {
      const kind = kinds[index] ?? 'lit';
      const key = rigid ? `${SceneProxy.RIGID}|${this.keys.of(part, kind)}` : this.keys.of(part, kind);
      const group = groups.get(key) ?? { kind, parts: [], rigid };
      group.parts.push(part);
      groups.set(key, group);
    });
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
    const current = ProxyParts.materialOf(mesh, source.slot);
    const texture = current ? ProxyBuilder.mapOf(current) : null;
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
   * Saca de los grupos las mallas con varios materiales que tienen alguna parte sola en su grupo (esa parte no
   * tendría lote): quedan originales enteras. Se repite hasta que no quede ninguna, porque sacar una malla
   * puede dejar sola la parte de otra.
   *
   * @param groups Grupos por clave.
   */
  private static prune(groups: Map<string, { parts: ProxyPart[] }>): void {
    for (;;) {
      const alone = new Set<Mesh>();
      groups.forEach(({ parts }) => {
        if (parts.length < 2) {
          parts.filter((part) => part.slot >= 0).forEach((part) => alone.add(part.mesh));
        }
      });
      if (alone.size === 0) {
        return;
      }
      groups.forEach((group, key) => {
        group.parts = group.parts.filter((part) => !alone.has(part.mesh));
        if (group.parts.length === 0) {
          groups.delete(key);
        }
      });
    }
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
