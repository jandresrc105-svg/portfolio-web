import type { Object3D, Quaternion, Vector3 } from 'three';

/**
 * Tabla con la pose de cada objeto del árbol de una pieza, para saber sin recorrer el árbol qué cambió desde el
 * último recálculo de matrices. three.js (aun con {@link PoseCheck}) visita cada objeto y lee su pose a través
 * del objeto, que en una escena con muchas clases distintas es lento; aquí las poses se leen de listas planas
 * (posiciones, rotaciones y escalas) y se comparan con las guardadas. Si nada cambió no hay que recorrer el
 * árbol; si algo cambió se recalculan solo esos objetos con sus descendientes, igual que lo haría three.js.
 * Un objeto cuenta como cambiado si cambió su pose o si alguien marcó que su matriz del mundo hay que
 * recalcularla; los que no recomponen su matriz solos (`matrixAutoUpdate` apagado) solo por lo segundo, y los
 * que tienen pivote siempre. Si cambia la estructura del árbol (se agrega o se quita un objeto), la tabla se
 * vuelve a armar.
 */
export class PoseTable {
  private static readonly SIZE = 10;
  private static readonly OFFSET = { quaternion: 3, scale: 7 };
  private static readonly KIND = { posed: 0, manual: 1, pivot: 2 };
  private static readonly CURRENT = new Float64Array(PoseTable.SIZE);

  private nodes: Object3D[] = [];
  private positions: Vector3[] = [];
  private quaternions: Quaternion[] = [];
  private scales: Vector3[] = [];
  private kinds = new Uint8Array(0);
  private ends = new Int32Array(0);
  private values = new Float64Array(0);
  private readonly changed: number[] = [];
  private version = -1;

  /**
   * Si la tabla está armada para esta versión de la estructura de la escena.
   *
   * @param version Versión de la estructura ({@link PoseJournal.structure}).
   * @returns `true` si se puede usar.
   */
  public matches(version: number): boolean {
    return this.version === version;
  }

  /**
   * Arma la tabla con el árbol actual y guarda las poses actuales (con las matrices ya al día).
   *
   * @param root Raíz de la pieza.
   * @param version Versión de la estructura de la escena.
   */
  public rebuild(root: Object3D, version: number): void {
    const nodes: Object3D[] = [];
    const ends: number[] = [];
    PoseTable.collect(root, nodes, ends);
    this.nodes = nodes;
    this.positions = nodes.map((node) => node.position);
    this.quaternions = nodes.map((node) => node.quaternion);
    this.scales = nodes.map((node) => node.scale);
    this.kinds = Uint8Array.from(nodes, (node) => PoseTable.kindOf(node));
    this.ends = Int32Array.from(ends);
    this.values = new Float64Array(nodes.length * PoseTable.SIZE);
    nodes.forEach((_node, index) => {
      this.store(index);
    });
    this.version = version;
  }

  /**
   * Objetos que cambiaron desde la última revisión, en orden de recorrido (padres antes que hijos). Guarda sus
   * poses nuevas.
   *
   * @returns Posiciones en la tabla (el arreglo se reutiliza en la siguiente llamada).
   */
  public scan(): readonly number[] {
    const changed = this.changed;
    changed.length = 0;
    const { nodes, kinds } = this;
    for (let index = 0; index < nodes.length; index += 1) {
      const kind = kinds[index];
      const marked = nodes[index]?.matrixWorldNeedsUpdate === true;
      if (marked || kind === PoseTable.KIND.pivot || (kind === PoseTable.KIND.posed && this.moved(index))) {
        changed.push(index);
      }
    }
    return changed;
  }

  /**
   * Recalcula las matrices de los objetos que cambiaron y de sus descendientes (una sola vez por subárbol).
   *
   * @param changed Posiciones que devolvió {@link PoseTable.scan}, sin la raíz.
   */
  public apply(changed: readonly number[]): void {
    let covered = 0;
    for (const index of changed) {
      if (index >= covered) {
        covered = this.ends[index] ?? covered;
        this.nodes[index]?.updateMatrixWorld();
      }
    }
  }

  /**
   * Si la pose de un objeto cambió desde la guardada (y, si cambió, guarda la nueva).
   *
   * @param index Posición en la tabla.
   * @returns `true` si cambió.
   */
  private moved(index: number): boolean {
    const current = PoseTable.CURRENT;
    this.read(index, current, 0);
    const values = this.values;
    const at = index * PoseTable.SIZE;
    for (let offset = 0; offset < PoseTable.SIZE; offset += 1) {
      if (values[at + offset] !== current[offset]) {
        values.set(current, at);
        return true;
      }
    }
    return false;
  }

  /**
   * Guarda la pose actual de un objeto en la tabla.
   *
   * @param index Posición en la tabla.
   */
  private store(index: number): void {
    this.read(index, this.values, index * PoseTable.SIZE);
  }

  /**
   * Copia la pose actual de un objeto (posición, rotación y escala) en un arreglo.
   *
   * @param index Posición en la tabla.
   * @param into Arreglo destino.
   * @param at Posición del primer valor en el destino.
   */
  private read(index: number, into: Float64Array, at: number): void {
    const { quaternion: q, scale: s } = PoseTable.OFFSET;
    const position = this.positions[index];
    const quaternion = this.quaternions[index];
    const scale = this.scales[index];
    if (!position || !quaternion || !scale) {
      return;
    }
    into[at] = position.x;
    into[at + 1] = position.y;
    into[at + 2] = position.z;
    into[at + q] = quaternion.x;
    into[at + q + 1] = quaternion.y;
    into[at + q + 2] = quaternion.z;
    into[at + q + 3] = quaternion.w;
    into[at + s] = scale.x;
    into[at + s + 1] = scale.y;
    into[at + s + 2] = scale.z;
  }

  /**
   * Recorre el árbol en orden (padres antes que hijos) y anota dónde termina el subárbol de cada objeto.
   *
   * @param node Objeto.
   * @param nodes Objetos recorridos.
   * @param ends Fin (exclusivo) del subárbol de cada objeto.
   */
  private static collect(node: Object3D, nodes: Object3D[], ends: number[]): void {
    const index = nodes.length;
    nodes.push(node);
    ends.push(index + 1);
    node.children.forEach((child) => {
      PoseTable.collect(child, nodes, ends);
    });
    ends[index] = nodes.length;
  }

  /**
   * Cómo se revisa un objeto.
   *
   * @param node Objeto.
   * @returns Tipo de revisión.
   */
  private static kindOf(node: Object3D): number {
    if (node.pivot !== null) {
      return PoseTable.KIND.pivot;
    }
    return node.matrixAutoUpdate ? PoseTable.KIND.posed : PoseTable.KIND.manual;
  }
}
