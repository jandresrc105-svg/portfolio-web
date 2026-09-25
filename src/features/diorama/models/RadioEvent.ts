/**
 * Aviso del receptor de radio a la escena: cambió el estado (encendido, modo, emisora sintonizada) o el
 * decodificador de morse reconoció una letra.
 */
export type RadioEvent = { readonly type: 'state' } | { readonly type: 'letter'; readonly letter: string };
