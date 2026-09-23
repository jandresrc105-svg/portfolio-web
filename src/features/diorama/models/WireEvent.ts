import type { WireStep } from './WireStep';

/**
 * Aviso de la estación de cableado a la escena y al sonido: cambió el estado, empezó un paso nuevo o se
 * cortaron hilos al pelar de más.
 */
export type WireEvent =
  | { readonly type: 'state' }
  | { readonly type: 'step'; readonly step: WireStep }
  | { readonly type: 'ruined' };
