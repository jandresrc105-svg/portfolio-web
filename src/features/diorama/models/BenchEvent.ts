/**
 * Aviso del banco del taller a la escena y al sonido: cambió el estado (placas, placa en prueba, fuente o
 * lámpara), se accionó un interruptor, o el visitante llevó una placa al banco.
 */
export type BenchEvent =
  | { readonly type: 'state' }
  | { readonly type: 'switch'; readonly on: boolean }
  | { readonly type: 'picked'; readonly index: number };
