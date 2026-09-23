/**
 * Estado del teléfono público de la cabina.
 */
export enum PhoneState {
  /** Colgado: la luz de llamada parpadea y el teléfono suena al abrir la sección. */
  OnHook = 'on-hook',
  /** Descolgado con tono de marcar, esperando una tecla. */
  DialTone = 'dial-tone',
  /** Marcó un número del marcado rápido: suena el tono de llamada. */
  Calling = 'calling',
  /** La llamada conectó y se abrió el canal. */
  Connected = 'connected',
  /** Marcó un número sin asignar: tono de ocupado y vuelve a pedir número. */
  Unassigned = 'unassigned',
}
