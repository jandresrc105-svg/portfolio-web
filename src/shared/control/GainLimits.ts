/**
 * Rango permitido de una ganancia y su paso de ajuste.
 */
export interface GainLimits {
  /** Valor mínimo. */
  readonly min: number;
  /** Valor máximo. */
  readonly max: number;
  /** Paso de ajuste. */
  readonly step: number;
}
