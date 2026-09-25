/**
 * Aviso del laboratorio de firmware: el buzzer suena, empieza una subida, termina o la placa se reinicia.
 */
export type FirmwareEvent =
  | { readonly type: 'tone'; readonly hz: number; readonly milliseconds: number }
  | { readonly type: 'upload' }
  | { readonly type: 'uploaded' }
  | { readonly type: 'reset' };
