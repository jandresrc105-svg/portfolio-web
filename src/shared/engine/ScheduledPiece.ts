import { Box3, Sphere, type Object3D } from 'three';
import type { DetailAware } from './DetailAware';
import type { PieceGroup } from './PieceGroup';
import { PoseJournal } from './PoseJournal';
import type { Updatable } from './Updatable';

/**
 * Pieza animada que el {@link UpdateScheduler} actualiza a pedido: a ritmo completo, a ritmo reducido o
 * congelada en su último cuadro. Guarda el tiempo que dejó de recibir para no dar saltos al volver y apaga el
 * recálculo de matrices de su árbol mientras no se actualiza en cada frame. Con las matrices congeladas (pieza
 * quieta) igual las recalcula de vez en cuando: si algo se recompuso ({@link PoseJournal}), la pieza empezó a
 * moverse y deja de estar congelada.
 */
export class ScheduledPiece {
  private static readonly MAX_DELTA = 0.05;
  private static readonly PROBE = { every: 0.25, slots: 8 };

  private readonly box = new Box3();
  private sphere: Sphere | null = null;
  private pending = 0;
  private detailed: boolean | null = null;
  private held = false;
  private sinceProbe: number;

  /**
   * Prepara la pieza.
   *
   * @param updatable Lógica que se actualiza.
   * @param root Raíz 3D de la pieza.
   * @param order Posición de la pieza en el planificador: reparte en distintos frames los recálculos de
   * prueba de las piezas congeladas, para que no caigan todos juntos.
   */
  public constructor(
    private readonly updatable: Updatable,
    private readonly root: PieceGroup,
    order: number,
  ) {
    const { every, slots } = ScheduledPiece.PROBE;
    this.sinceProbe = ((order % slots) / slots) * every;
  }

  /**
   * Esfera que envuelve la pieza en el mundo (se calcula una vez, la primera vez que se pide). Una pieza sin
   * geometría (solo luces, p. ej.) no tiene esfera y siempre va a ritmo completo.
   *
   * @returns Esfera, o `null` si la pieza está vacía.
   */
  public get bounds(): Sphere | null {
    if (!this.sphere) {
      this.root.updateMatrixWorld(true);
      this.box.setFromObject(this.root);
      this.sphere = this.box.isEmpty() ? new Sphere() : this.box.getBoundingSphere(new Sphere());
    }
    return this.sphere.isEmpty() ? null : this.sphere;
  }

  /**
   * Si la raíz de esta pieza es la indicada.
   *
   * @param root Raíz.
   * @returns `true` si es la suya.
   */
  public owns(root: Object3D): boolean {
    return this.root === root;
  }

  /**
   * Congela las matrices de la pieza (no se dibuja su original, así que no hace falta recalcularlas); su lógica
   * sigue corriendo.
   *
   * @param held `true` para congelar.
   */
  public setHeld(held: boolean): void {
    this.held = held;
  }

  /**
   * Avisa a la pieza (si le interesa) si se ve con detalle, solo cuando cambia.
   *
   * @param detailed `true` si se ve grande en pantalla.
   */
  public setDetailed(detailed: boolean): void {
    if (detailed === this.detailed) {
      return;
    }
    this.detailed = detailed;
    if ('setDetailed' in this.updatable) {
      (this.updatable as Updatable & DetailAware).setDetailed(detailed);
    }
  }

  /**
   * Actualiza en este frame, con las matrices del árbol al día.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  public run(delta: number, elapsed: number): void {
    this.root.paused = this.held;
    this.updatable.update(Math.min(this.pending + delta, ScheduledPiece.MAX_DELTA), elapsed);
    this.pending = 0;
    if (this.held) {
      this.probe(delta);
    }
  }

  /**
   * Actualiza a ritmo reducido: junta el tiempo y solo corre cuando se completa un paso.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   * @param step Segundos entre actualizaciones.
   */
  public throttle(delta: number, elapsed: number, step: number): void {
    this.root.paused = true;
    this.pending += delta;
    if (this.pending < step) {
      return;
    }
    const waited = this.pending;
    this.updatable.update(Math.min(waited, ScheduledPiece.MAX_DELTA), elapsed);
    this.pending = 0;
    if (this.held) {
      this.probe(waited);
    } else {
      this.root.refreshMatrices();
    }
  }

  /**
   * No actualiza: la pieza queda quieta en su último cuadro (está fuera de cámara).
   *
   * @param delta Segundos desde el frame anterior.
   */
  public hold(delta: number): void {
    this.root.paused = true;
    this.pending = Math.min(this.pending + delta, ScheduledPiece.MAX_DELTA);
  }

  /**
   * Con las matrices congeladas, las recalcula cada tanto; si algo se recompuso, la pieza se movió y deja de
   * estar congelada (vuelve a recalcular sus matrices en cada actualización).
   *
   * @param delta Segundos desde la actualización anterior.
   */
  private probe(delta: number): void {
    this.sinceProbe += delta;
    if (this.sinceProbe < ScheduledPiece.PROBE.every) {
      return;
    }
    this.sinceProbe = 0;
    const journal = PoseJournal.shared;
    const before = journal.recorded;
    this.root.refreshMatrices();
    if (journal.recorded !== before) {
      this.held = false;
    }
  }
}
