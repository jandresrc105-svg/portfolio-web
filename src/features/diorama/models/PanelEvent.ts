/**
 * Aviso del tablero del poste a la escena y al sonido: cambió el estado (puerta, MAIN, breakers o etapa
 * elegida), se abrió o cerró la puerta, se accionó una palanca, o el visitante subió el breaker de una etapa.
 */
export type PanelEvent =
  | { readonly type: 'state' }
  | { readonly type: 'door'; readonly open: boolean }
  | { readonly type: 'switch'; readonly on: boolean }
  | { readonly type: 'picked'; readonly index: number };
