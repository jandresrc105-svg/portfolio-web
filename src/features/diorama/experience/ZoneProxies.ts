import type { Object3D, Scene } from 'three';
import type { RenderGate } from '@shared/engine/RenderGate';
import { SceneProxy } from '@shared/engine/SceneProxy';
import type { Updatable } from '@shared/engine/Updatable';
import type { UpdateScheduler } from '@shared/engine/UpdateScheduler';

/**
 * Versiones unidas del diorama por zona (patrón Mediator entre las paradas, las versiones unidas y el
 * planificador): el taller se reemplaza fuera de sus paradas y la calle en la vista general y en las paradas del
 * taller. En la parada de una zona siempre se ve la original, que es la que se puede usar. Junta las piezas
 * quietas de las dos zonas para que el planificador deje de recalcular sus matrices.
 */
export class ZoneProxies implements Updatable {
  private readonly workshop: SceneProxy;
  private readonly street: SceneProxy;
  private readonly still = new Map<SceneProxy, Object3D[]>();

  /**
   * Arma las dos versiones unidas (todavía inactivas).
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
   * Activa o desactiva cada versión unida según la parada.
   *
   * @param stop Parada destino (0 = vista general).
   */
  public switchTo(stop: number): void {
    const inWorkshop = this.workshopStops.includes(stop);
    if (inWorkshop) {
      this.workshop.deactivate();
    } else {
      this.workshop.activate();
    }
    if (stop === 0 || inWorkshop) {
      this.street.activate();
    } else {
      this.street.deactivate();
    }
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
    const proxy = new SceneProxy(scene, roots, [], gate);
    proxy.onSettled((still) => {
      this.still.set(proxy, still);
      this.scheduler.hold([...this.still.values()].flat());
    });
    return proxy;
  }
}
