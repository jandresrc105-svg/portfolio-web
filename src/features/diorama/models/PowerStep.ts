import type { PowerMode } from './PowerMode';
import type { Powerable } from './Powerable';

/**
 * Paso de la secuencia de encendido: qué se enciende, cuándo y cómo.
 */
export interface PowerStep {
  /** Elemento a encender. */
  readonly target: Powerable;
  /** Segundo de la intro en que empieza a encenderse. */
  readonly at: number;
  /** Forma de encendido. */
  readonly mode: PowerMode;
}
