/**
 * Pieza que se desplaza por la escena (p. ej. un personaje que camina de un lugar a otro). El
 * {@link UpdateScheduler} decide el ritmo de cada pieza con una esfera calculada una sola vez donde estaba al
 * empezar; una pieza que se aleja de ahí quedaría congelada al salir esa esfera de cámara, así que las que se
 * desplazan van siempre a ritmo completo.
 */
export interface Roaming {
  /** Si la pieza se desplaza (siempre `true` en quien lo implementa). */
  readonly roaming: boolean;
}
