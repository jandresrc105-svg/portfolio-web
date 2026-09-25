/**
 * Interruptor de una línea de energía (p. ej. lo que cuelga del MAIN del tablero del poste).
 */
export interface PowerSwitch {
  /**
   * Cierra (conduce) o abre (corta) la línea.
   *
   * @param closed `true` para dar energía.
   */
  setClosed(closed: boolean): void;
}
