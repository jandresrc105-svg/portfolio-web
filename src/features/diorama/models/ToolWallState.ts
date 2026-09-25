import type { ToolId } from './ToolId';

/**
 * Estado de la pared de herramientas.
 */
export interface ToolWallState {
  /** Herramienta tomada (fuera de su gancho) o `null`. */
  readonly held: ToolId | null;
  /** Ángulo de inspección de la herramienta tomada, en radianes. */
  readonly turn: number;
  /** Apertura del mecanismo de la herramienta tomada [0, 1] (mordazas, émbolo, corredera). */
  readonly open: number;
  /** Lectura del calibrador en milímetros (0 si no es el calibrador el que está tomado). */
  readonly reading: number;
}
