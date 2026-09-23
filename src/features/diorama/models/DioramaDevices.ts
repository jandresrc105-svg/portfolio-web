import type { BreakerPanelService } from '../services/BreakerPanelService';
import type { PayPhoneService } from '../services/PayPhoneService';
import type { ScopeControlService } from '../services/ScopeControlService';

/**
 * Equipos de la escena que el visitante usa: el osciloscopio de la barra, el teléfono de la cabina y el
 * tablero del poste.
 */
export interface DioramaDevices {
  /** Tablero del osciloscopio (lazo PID y estado del equipo). */
  readonly instrument: ScopeControlService;
  /** Teléfono público de la cabina. */
  readonly phone: PayPhoneService;
  /** Tablero de breakers de la trayectoria. */
  readonly panel: BreakerPanelService;
}
