import { Group } from 'three';

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

  /**
   * @inheritdoc
   */
  public override updateMatrixWorld(force?: boolean): void {
    if (this.paused && force !== true) {
      return;
    }
    super.updateMatrixWorld(force);
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
}
