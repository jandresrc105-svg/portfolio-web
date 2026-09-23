import type { WireStep } from './WireStep';

/**
 * Estado de la estación de cableado.
 */
export interface WireStationState {
  /** Paso actual. */
  readonly step: WireStep;
  /** Etapa del panel de progreso (0 = cortar … 4 = conectar, 5 = todo listo). */
  readonly stage: number;
  /** Avance del pelado: 0 = aislante entero, 1 = aislante fuera. */
  readonly strip: number;
  /** Avance de la torsión de los hilos: 0 = sueltos, 1 = trenzados. */
  readonly twist: number;
  /** Avance de la animación del paso actual (0…1); 0 en los pasos que esperan al visitante. */
  readonly timer: number;
  /** Si el pelacables ya está mordiendo el aislante. */
  readonly gripping: boolean;
}
