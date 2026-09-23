import type { ContactChannel } from '@shared/core/events/ContactChannel';
import type { PhoneLine } from './PhoneLine';

/**
 * Aviso del teléfono a la escena y al sonido: cambió el estado (y la pantalla), se movió el auricular, se
 * pulsó una tecla, cambió el tono de la línea, sonó el timbre o conectó una llamada.
 */
export type PhoneEvent =
  | { readonly type: 'state' }
  | { readonly type: 'hook'; readonly lifted: boolean }
  | { readonly type: 'key'; readonly key: string }
  | { readonly type: 'line'; readonly line: PhoneLine }
  | { readonly type: 'ring' }
  | { readonly type: 'connect'; readonly channel: ContactChannel };
