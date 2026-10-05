import type { Updatable } from '@shared/engine/Updatable';
import type { DaylightAware } from '../models/DaylightAware';
import type { Powerable } from '../models/Powerable';
import type { ShopFixture } from '../models/ShopFixture';
import { ClosingRoutine } from './ClosingRoutine';
import { ShopSwitch } from './ShopSwitch';

/**
 * Horario del ramen: abre de tarde y de noche y cierra de día (patrón Observer). Cerrar no es un corte: el
 * cocinero lo hace siguiendo el guion de {@link ClosingRoutine} (va a la barra, enrolla el noren, baja la cortina
 * y vuelve a la olla) y abrir es el mismo guion al revés. Las luces del local (faroles, guirnalda y neones) se
 * apagan mientras baja la cortina; la cocina sigue encendida, porque el cocinero sigue preparando. Al cargar la
 * escena el local aparece directamente abierto o cerrado.
 */
export class ShopHours implements DaylightAware, Updatable {
  private static readonly CLOSE_AT = 0.75;

  private readonly routine = new ClosingRoutine();
  private readonly switches: ShopSwitch[] = [];
  private readonly fixtures: ShopFixture[] = [];
  private progress = 0;
  private target = 0;
  private started = false;

  /**
   * Pasa una luz del local por su interruptor.
   *
   * @param light Luz del ramen.
   * @returns Interruptor, que es lo que se conecta a la red.
   */
  public wire(light: Powerable): Powerable {
    const toggle = new ShopSwitch(light);
    this.switches.push(toggle);
    return toggle;
  }

  /**
   * Suma una parte que acompaña el cierre y la apertura.
   *
   * @param fixture Parte del local.
   * @returns La misma parte.
   */
  public attach<T extends ShopFixture>(fixture: T): T {
    this.fixtures.push(fixture);
    return fixture;
  }

  /**
   * @inheritdoc
   */
  public setDaylight(level: number): void {
    this.target = level >= ShopHours.CLOSE_AT ? 1 : 0;
    if (!this.started) {
      this.started = true;
      this.progress = this.target;
      this.apply();
    }
  }

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    if (this.progress === this.target) {
      return;
    }
    const step = delta / ClosingRoutine.SECONDS;
    this.progress =
      this.target > this.progress ? Math.min(this.progress + step, 1) : Math.max(this.progress - step, 0);
    this.apply();
  }

  /**
   * Lleva el avance del guion a las luces y a cada parte del local.
   */
  private apply(): void {
    const lights = 1 - this.routine.lights(this.progress);
    this.switches.forEach((toggle) => {
      toggle.setOpen(lights);
    });
    this.fixtures.forEach((fixture) => {
      fixture.setClosure(this.progress);
    });
  }
}
