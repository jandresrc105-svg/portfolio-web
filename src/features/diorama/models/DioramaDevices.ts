import type { PayPhoneService } from '../services/PayPhoneService';
import type { ScopeControlService } from '../services/ScopeControlService';

/**
 * Equipos de la escena que el visitante usa: el osciloscopio de la barra y el teléfono de la cabina.
 */
export interface DioramaDevices {
  /** Tablero del osciloscopio (lazo PID y estado del equipo). */
  readonly instrument: ScopeControlService;
  /** Teléfono público de la cabina. */
  readonly phone: PayPhoneService;
}
