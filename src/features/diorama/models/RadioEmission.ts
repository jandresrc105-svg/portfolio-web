/**
 * Lo que una emisora pone en el aire en este instante, tal como llega a la antena (para el espectro).
 */
export interface RadioEmission {
  /** Frecuencia de la portadora en kHz. */
  readonly frequency: number;
  /** Amplitud de la portadora recibida (0 si la baliza CW tiene la llave levantada). */
  readonly amplitude: number;
  /** Profundidad de modulación de las bandas laterales (0 en CW). */
  readonly modulation: number;
}
