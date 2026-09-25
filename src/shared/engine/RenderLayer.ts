/**
 * Capas de render de three.js usadas para decidir qué ve cada cámara.
 */
export enum RenderLayer {
  /** Objetos del diorama: los ve la cámara principal. */
  Default = 0,
  /** Fondo lejano (cielo, ciudad): solo la cámara principal. */
  Background = 1,
  /** Objetos luminosos que además aparecen en los reflejos de los charcos (neones, faroles, pantallas). */
  Reflected = 2,
  /**
   * Objetos que la {@link RenderGate} sacó del render (se dibujan desde un lote o son diminutos): ninguna
   * cámara la ve, pero el puntero sí, para que se puedan tocar igual.
   */
  Gated = 3,
}
