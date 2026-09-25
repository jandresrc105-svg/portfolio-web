import type { ScopeControlId } from './ScopeControlId';

/**
 * Perilla de un panel frontal. Posición y medidas en metros desde el centro del panel.
 */
export interface PanelKnob {
  /** Centro horizontal. */
  readonly x: number;
  /** Centro vertical. */
  readonly y: number;
  /** Radio. */
  readonly radius: number;
  /** Control que ajusta, si el visitante puede girarla. */
  readonly control?: ScopeControlId;
}
