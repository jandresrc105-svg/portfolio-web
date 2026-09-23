/**
 * Tono que se escucha por el auricular.
 */
export enum PhoneLine {
  /** Sin tono. */
  Silent = 'silent',
  /** Tono continuo de marcar. */
  DialTone = 'dial-tone',
  /** Tono de llamada: suena y calla a intervalos largos. */
  Ringback = 'ringback',
  /** Tono de ocupado: pulsos cortos. */
  Busy = 'busy',
}
