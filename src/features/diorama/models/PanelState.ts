/**
 * Lo que la escena necesita para dibujar el tablero del poste.
 */
export interface PanelState {
  /** Si la puerta está abierta. */
  readonly open: boolean;
  /** Si el breaker general (MAIN) está arriba. */
  readonly main: boolean;
  /** Posición de cada breaker de etapa (`true` = arriba). */
  readonly breakers: readonly boolean[];
  /** Cuántas etapas, desde la primera, reciben corriente (el circuito es en serie). */
  readonly energized: number;
  /** Etapa elegida en la vitrina (índice desde 0). */
  readonly selected: number;
}
