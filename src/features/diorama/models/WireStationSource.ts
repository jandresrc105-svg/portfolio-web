import type { Updatable } from '@shared/engine/Updatable';
import type { WireStationState } from './WireStationState';

/**
 * Lo que la pieza 3D de la estación de cableado lee en cada frame: el estado vigente, y el reloj que hace
 * avanzar las animaciones de los pasos (tirar cable, estañar, conectar).
 */
export interface WireStationSource extends Updatable {
  /** Estado vigente. */
  readonly state: WireStationState;
}
