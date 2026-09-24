import type { Object3D, Scene } from 'three';
import type { RenderGate } from '@shared/engine/RenderGate';
import { SceneProxy } from '@shared/engine/SceneProxy';
import type { Updatable } from '@shared/engine/Updatable';
import type { UpdateScheduler } from '@shared/engine/UpdateScheduler';

/**
 * Versiones unidas del diorama por zona (patrón Mediator entre las paradas, las versiones unidas y el
 * planificador): las dos zonas (taller y calle) se dibujan unidas en todas las paradas; lo que el visitante
 * mueve o lo que se anima se saca solo del lote y se ve como original. Al cambiar de parada se vuelve a meter en
 * los lotes lo que ya quedó quieto. Las piezas quietas dejan de recalcular sus matrices, salvo las de la zona que
 * se está usando: una matriz congelada no deja ver que algo se movió.
 */
export class ZoneProxies implements Updatable {
  private static readonly IDLE_STRIDE = 4;

  private readonly workshop: SceneProxy;
  private readonly street: SceneProxy;
  private readonly still = new Map<SceneProxy, Object3D[]>();
  private inUse: SceneProxy | null = null;

  /**
   * Arma las dos versiones unidas (todavía sin lotes: se arman en la primera parada).
   *
   * @param scene Escena.
   * @param roots Raíces de cada zona.
   * @param roots.workshop Raíces del taller.
   * @param roots.street Raíces de la calle (sin los marcadores).
   * @param gate Compuerta de la capa de la cámara.
   * @param scheduler Planificador que congela las matrices de las piezas quietas.
   * @param workshopStops Paradas del taller.
   */
  public constructor(
    scene: Scene,
    roots: { workshop: readonly Object3D[]; street: readonly Object3D[] },
    gate: RenderGate,
    private readonly scheduler: UpdateScheduler,
    private readonly workshopStops: readonly number[],
  ) {
    this.workshop = this.create(scene, roots.workshop, gate);
    this.street = this.create(scene, roots.street, gate);
  }

  /**
   * Activa las versiones unidas (la primera vez), vuelve a meter en los lotes lo que quedó quieto y decide qué
   * zona se está usando.
   *
   * @param stop Parada destino (0 = vista general).
   */
  public switchTo(stop: number): void {
    this.inUse = this.zoneOf(stop);
    [this.workshop, this.street].forEach((proxy) => {
      proxy.setStride(proxy === this.inUse ? 1 : ZoneProxies.IDLE_STRIDE);
      proxy.activate();
      proxy.refresh();
    });
    this.hold();
  }

  /**
   * Avisa cada vez que alguna zona arma lotes nuevos (para preparar sus shaders antes de dibujarlos).
   *
   * @param listener Recibe las mallas de los lotes nuevos.
   */
  public onBuilt(listener: (meshes: readonly Object3D[]) => void): void {
    this.workshop.onBuilt(listener);
    this.street.onBuilt(listener);
  }

  /**
   * Copias articuladas de los lotes de las dos zonas, para precompilar esa variante de sus shaders.
   *
   * @returns Mallas articuladas (no se agregan a la escena).
   */
  public rigVariants(): Object3D[] {
    return [...this.workshop.rigVariants(), ...this.street.rigVariants()];
  }

  /**
   * @inheritdoc
   */
  public update(): void {
    this.workshop.update();
    this.street.update();
  }

  /**
   * Crea una versión unida que avisa sus piezas quietas.
   *
   * @param scene Escena.
   * @param roots Raíces de la zona.
   * @param gate Compuerta de la capa de la cámara.
   * @returns Versión unida.
   */
  private create(scene: Scene, roots: readonly Object3D[], gate: RenderGate): SceneProxy {
    const proxy = new SceneProxy(scene, roots, gate);
    proxy.onSettled((still) => {
      this.still.set(proxy, still);
      this.hold();
    });
    return proxy;
  }

  /**
   * Zona que se usa en una parada.
   *
   * @param stop Parada (0 = vista general, donde no se usa ninguna).
   * @returns Versión unida de la zona o `null`.
   */
  private zoneOf(stop: number): SceneProxy | null {
    if (stop === 0) {
      return null;
    }
    return this.workshopStops.includes(stop) ? this.workshop : this.street;
  }

  /**
   * Congela las matrices de las piezas quietas de las zonas que no se están usando.
   */
  private hold(): void {
    const held = [...this.still].filter(([proxy]) => proxy !== this.inUse).flatMap(([, still]) => still);
    this.scheduler.hold(held);
  }
}
