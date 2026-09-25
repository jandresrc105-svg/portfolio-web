/**
 * Estado de las luces y del ambiente del taller.
 */
export interface ShopLightsState {
  /** Si las luminarias del techo están encendidas. */
  readonly ceiling: boolean;
  /** Si la tira LED del banco está encendida. */
  readonly bench: boolean;
  /** Si el letrero de neón OPEN está encendido. */
  readonly sign: boolean;
  /** Si la bola de plasma está encendida. */
  readonly plasma: boolean;
  /** Posición del dimmer del techo [0, 1] (fracción de la potencia entregada a las luminarias). */
  readonly dimmer: number;
  /** Ángulo de disparo del TRIAC del dimmer, en grados (0° = onda completa, 180° = nada). */
  readonly firingAngle: number;
}
