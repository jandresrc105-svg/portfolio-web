import { Group } from 'three';
import { PoseJournal } from './PoseJournal';
import { PoseTable } from './PoseTable';

/**
 * Raíz de una pieza de la escena que puede pausar el recálculo de matrices de todo su árbol. three.js recorre
 * siempre a todos los hijos al actualizar las matrices, aunque no haya nada que recalcular; mientras la pieza
 * está pausada (quieta, fuera de cámara o esperando su turno a ritmo reducido) el recorrido la salta entera.
 * Una actualización forzada (`updateMatrixWorld(true)`, p. ej. al medir la pieza o al armar un lote) la
 * recorre igual.
 */
export class PieceGroup extends Group {
  /** Si el recorrido de matrices salta esta pieza. */
  public paused = false;

  private readonly poses = new PoseTable();

  /**
   * Recalcula las matrices que cambiaron. Sin forzar, no recorre el árbol: su {@link PoseTable} dice qué
   * objetos cambiaron y solo se recalculan esos con sus descendientes (el resultado es el mismo que el recorrido
   * de three.js). Forzado, o si cambió la estructura de la escena, recorre todo y vuelve a armar la tabla.
   *
   * @param force Recalcular todas las matrices.
   */
  public override updateMatrixWorld(force?: boolean): void {
    if (this.paused && force !== true) {
      return;
    }
    const structure = PoseJournal.shared.structure;
    if (force === true || !this.poses.matches(structure)) {
      super.updateMatrixWorld(force);
      if (!this.poses.matches(structure)) {
        this.poses.rebuild(this, structure);
      }
      return;
    }
    this.refreshChanged();
  }

  /**
   * Recalcula las matrices que cambiaron aunque la pieza esté pausada (en su turno a ritmo reducido).
   */
  public refreshMatrices(): void {
    const paused = this.paused;
    this.paused = false;
    this.updateMatrixWorld();
    this.paused = paused;
  }

  /**
   * Recalcula las matrices de lo que cambió según la tabla de poses (todo el árbol si cambió la raíz).
   */
  private refreshChanged(): void {
    const changed = this.poses.scan();
    if (changed.length === 0) {
      return;
    }
    if (changed[0] === 0) {
      super.updateMatrixWorld();
      return;
    }
    this.poses.apply(changed);
  }
}
