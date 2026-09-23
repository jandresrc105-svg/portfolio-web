import type { ToolId } from './ToolId';

/**
 * Ficha de una herramienta de la pared: su nombre y el dato didáctico que se muestra al tomarla.
 */
export interface ToolInfo {
  /** Herramienta. */
  readonly id: ToolId;
  /** Nombre visible. */
  readonly name: string;
  /** Para qué sirve o un truco de uso (se muestra con la herramienta en la mano). */
  readonly tip: string;
  /** Si la herramienta mide (el tooltip muestra la lectura en milímetros). */
  readonly measures?: boolean;
}
