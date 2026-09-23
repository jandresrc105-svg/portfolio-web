import { Box3, Sphere, type Object3D } from 'three';
import type { DetailAware } from './DetailAware';
import type { Updatable } from './Updatable';

/**
 * Pieza animada que el {@link UpdateScheduler} actualiza a pedido: a ritmo completo, a ritmo reducido o
 * congelada en su último cuadro. Guarda el tiempo que dejó de recibir para no dar saltos al volver y apaga el
 * recálculo de matrices de su árbol mientras no se actualiza en cada frame.
 */
export class ScheduledPiece {
  private static readonly MAX_DELTA = 0.05;

  private readonly box = new Box3();
  private sphere: Sphere | null = null;
  private pending = 0;
  private detailed: boolean | null = null;
  private held = false;

  /**
   * Prepara la pieza.
   *
   * @param updatable Lógica que se actualiza.
   * @param root Raíz 3D de la pieza.
   */
  public constructor(
    private readonly updatable: Updatable,
    private readonly root: Object3D,
  ) {}

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
    this.root.matrixWorldAutoUpdate = !this.held;
    this.updatable.update(Math.min(this.pending + delta, ScheduledPiece.MAX_DELTA), elapsed);
    this.pending = 0;
  }

  /**
   * Actualiza a ritmo reducido: junta el tiempo y solo corre cuando se completa un paso.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   * @param step Segundos entre actualizaciones.
   */
  public throttle(delta: number, elapsed: number, step: number): void {
    this.root.matrixWorldAutoUpdate = false;
    this.pending += delta;
    if (this.pending < step) {
      return;
    }
    this.updatable.update(Math.min(this.pending, ScheduledPiece.MAX_DELTA), elapsed);
    this.pending = 0;
    if (!this.held) {
      this.root.updateMatrixWorld(true);
    }
  }

  /**
   * No actualiza: la pieza queda quieta en su último cuadro (está fuera de cámara).
   *
   * @param delta Segundos desde el frame anterior.
   */
  public hold(delta: number): void {
    this.root.matrixWorldAutoUpdate = false;
    this.pending = Math.min(this.pending + delta, ScheduledPiece.MAX_DELTA);
  }
}
