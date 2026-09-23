import type { GainLimits } from '@shared/control/GainLimits';

/**
 * Perilla del osciloscopio: cómo lee y escribe su valor, su rango y el texto que muestra.
 */
export interface ScopeDial {
  /** Valor actual. */
  readonly read: () => number;
  /** Rango y paso (paso 1 = perilla con posiciones fijas). */
  readonly limits: () => GainLimits;
  /** Aplica un valor nuevo (quien lo recibe lo ajusta a su rango). */
  readonly write: (value: number) => void;
  /** Texto para el tooltip. */
  readonly text: (value: number) => string;
}
