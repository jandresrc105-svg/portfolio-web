import type { Mesh, Object3D } from 'three';
import { PoseJournal } from './PoseJournal';
import type { ProxySource } from './ProxySource';

/**
 * Detecta qué mallas copiadas en una versión unida se movieron, sin comparar cada frame la matriz del mundo de
 * todas: la matriz de una malla solo cambia si recompuso su matriz local ella o algún antecesor, y eso lo anota
 * el {@link PoseJournal}. Así cada frame se revisan solo las mallas que cuelgan de lo que se recompuso, en el
 * mismo momento en que antes se comparaban todas (lo que se mueve se ve como original al frame siguiente,
 * igual que antes). Por las dudas (una matriz cambiada a mano, p. ej.) cada frame compara además una parte
 * fija de todas, así nada queda sin revisar más de unos frames; y si el registro se desbordó, compara todas.
 */
export class ProxyMotion {
  private static readonly SWEEP = 16;

  private readonly under = new Map<Object3D, ProxySource[]>();
  private readonly pending = new Set<Object3D>();
  private readonly waiting: Object3D[] = [];
  private readonly found: ProxySource[] = [];
  private sources: readonly ProxySource[] = [];
  private dropped: ReadonlySet<Mesh> = new Set();
  private flagged: ReadonlySet<Mesh> = new Set();
  private turn = 0;

  /**
   * Empieza a vigilar las mallas de los lotes vigentes: anota, para cada objeto, qué mallas cuelgan de él.
   *
   * @param sources Mallas copiadas, con sus matrices al copiarlas.
   */
  public watch(sources: readonly ProxySource[]): void {
    this.sources = sources;
    this.under.clear();
    this.pending.clear();
    sources.forEach((source) => {
      for (let node: Object3D | null = source.mesh; node; node = node.parent) {
        const list = this.under.get(node);
        if (list) {
          list.push(source);
        } else {
          this.under.set(node, [source]);
        }
      }
    });
  }

  /**
   * Mallas copiadas que se movieron desde que se copiaron (puede repetir alguna), según lo que se recompuso
   * desde la última vez.
   *
   * @param dropped Mallas ya apagadas en los lotes (no se revisan).
   * @param flagged Mallas ya anotadas en este frame por otro cambio (no se revisan).
   * @returns Mallas que se movieron (el arreglo se reutiliza en la siguiente llamada).
   */
  public moved(dropped: ReadonlySet<Mesh>, flagged: ReadonlySet<Mesh>): readonly ProxySource[] {
    this.found.length = 0;
    this.dropped = dropped;
    this.flagged = flagged;
    const journal = PoseJournal.shared;
    if (journal.overflowed) {
      this.inspectAll(this.sources, 0, 1);
    } else {
      this.retry();
      this.visitAll(journal.entries);
      this.inspectAll(this.sources, this.turn % ProxyMotion.SWEEP, ProxyMotion.SWEEP);
    }
    this.turn += 1;
    return this.found;
  }

  /**
   * Vuelve a revisar los objetos que se recompusieron pero todavía no tenían su matriz del mundo al día.
   */
  private retry(): void {
    if (this.pending.size === 0) {
      return;
    }
    const waiting = this.waiting;
    for (const object of this.pending) {
      waiting.push(object);
    }
    this.pending.clear();
    this.visitAll(waiting);
    waiting.length = 0;
  }

  /**
   * Revisa las mallas que cuelgan de cada objeto recompuesto.
   *
   * @param objects Objetos recompuestos.
   */
  private visitAll(objects: readonly Object3D[]): void {
    for (const object of objects) {
      this.visit(object);
    }
  }

  /**
   * Revisa las mallas que cuelgan de un objeto recompuesto. Si su matriz del mundo todavía no se recalculó (se
   * recompuso a mano, fuera del recorrido de matrices), lo deja para el frame siguiente.
   *
   * @param object Objeto recompuesto.
   */
  private visit(object: Object3D): void {
    const list = this.under.get(object);
    if (!list) {
      return;
    }
    if (object.matrixWorldNeedsUpdate) {
      this.pending.add(object);
      return;
    }
    this.inspectAll(list, 0, 1);
  }

  /**
   * Compara las matrices de una parte de las mallas.
   *
   * @param sources Mallas.
   * @param first Primera que se revisa.
   * @param step Cada cuántas se revisa una.
   */
  private inspectAll(sources: readonly ProxySource[], first: number, step: number): void {
    for (let index = first; index < sources.length; index += step) {
      const source = sources[index];
      if (source && !source.rigid && !this.dropped.has(source.mesh) && !this.flagged.has(source.mesh)) {
        this.inspect(source);
      }
    }
  }

  /**
   * Anota la malla si su matriz del mundo ya no es la que se copió.
   *
   * @param source Malla con su estado copiado.
   */
  private inspect(source: ProxySource): void {
    if (!source.mesh.matrixWorld.equals(source.matrix)) {
      this.found.push(source);
    }
  }
}
