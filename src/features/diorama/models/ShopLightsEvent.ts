import type { ShopLightsControl } from './ShopLightsControl';

/**
 * Aviso de las luces del taller a la escena y al sonido: se accionó una palanca (o la bola de plasma) o se
 * giró el dimmer.
 */
export type ShopLightsEvent =
  | { readonly type: 'switch'; readonly control: ShopLightsControl; readonly on: boolean }
  | { readonly type: 'dimmer'; readonly level: number };
