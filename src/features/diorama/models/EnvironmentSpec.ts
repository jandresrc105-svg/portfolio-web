import type { EnvironmentPanel } from './EnvironmentPanel';

/**
 * Escena de referencia para hornear un mapa de entorno: una caja de un color con franjas emisivas.
 */
export interface EnvironmentSpec {
  /** Caja que rodea la escena. */
  readonly room: { readonly size: number; readonly color: number };
  /** Franjas emisivas, mirando hacia el centro. */
  readonly panels: readonly EnvironmentPanel[];
}
