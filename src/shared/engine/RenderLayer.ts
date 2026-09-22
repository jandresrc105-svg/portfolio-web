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
}
