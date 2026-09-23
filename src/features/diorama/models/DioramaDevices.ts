import type { BreakerPanelService } from '../services/BreakerPanelService';
import type { PayPhoneService } from '../services/PayPhoneService';
import type { ScopeControlService } from '../services/ScopeControlService';
import type { WorkbenchService } from '../services/WorkbenchService';

/**
 * Equipos de la escena que el visitante usa: el osciloscopio de la barra, el teléfono de la cabina, el
 * tablero del poste y el banco del taller.
 */
export interface DioramaDevices {
  /** Tablero del osciloscopio (lazo PID y estado del equipo). */
  readonly instrument: ScopeControlService;
  /** Teléfono público de la cabina. */
  readonly phone: PayPhoneService;
  /** Tablero de breakers de la trayectoria. */
  readonly panel: BreakerPanelService;
  /** Banco de pruebas del taller (placas de los proyectos). */
  readonly bench: WorkbenchService;
}
