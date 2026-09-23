import type { ScopeControlId } from './ScopeControlId';

/**
 * Tecla de goma de un panel frontal. Posición y medidas en metros desde el centro del panel.
 */
export interface PanelKey {
  /** Centro horizontal. */
  readonly x: number;
  /** Centro vertical. */
  readonly y: number;
  /** Ancho. */
  readonly width: number;
  /** Alto. */
  readonly height: number;
  /** Color de la goma y de su luz. */
  readonly color: number;
  /** Intensidad de la luz de fondo cuando está encendida (0 = tecla sin luz). */
  readonly glow: number;
  /** Control que acciona, si el visitante puede pulsarla. */
  readonly control?: ScopeControlId;
}
