/**
 * Aviso del circuito de la Ley de Ohm a la escena y al sonido: cambió el estado, una perilla pasó por una
 * detención, se accionó el interruptor, el LED se quemó o se puso uno nuevo.
 */
export type OhmLabEvent =
  | { readonly type: 'state' }
  | { readonly type: 'detent' }
  | { readonly type: 'switch'; readonly on: boolean }
  | { readonly type: 'burn' }
  | { readonly type: 'replace' };
