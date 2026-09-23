import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { FirmwareLabDevice } from './FirmwareLabDevice';
import { OhmLabDevice } from './OhmLabDevice';
import { RadioStationDevice } from './RadioStationDevice';
import { ShopLightsDevice } from './ShopLightsDevice';
import { ToolWallDevice } from './ToolWallDevice';
import { WireStationDevice } from './WireStationDevice';

/**
 * Catálogo de los equipos interactivos del taller (patrón Factory): cada equipo nuevo se agrega aquí con una
 * línea. El banco de los proyectos y el osciloscopio no están aquí: tienen su propia conexión.
 */
export class WorkshopCatalog {
  /**
   * Crea todos los equipos del taller.
   *
   * @param context Materiales, texturas, ubicación, audio y azar.
   * @returns Equipos, en el orden en que se prueban con el puntero.
   */
  public create(context: WorkshopContext): WorkshopDevice[] {
    return [
      new ShopLightsDevice(context),
      new OhmLabDevice(context),
      new WireStationDevice(context),
      new ToolWallDevice(context),
      new FirmwareLabDevice(context),
      new RadioStationDevice(context),
    ];
  }
}
