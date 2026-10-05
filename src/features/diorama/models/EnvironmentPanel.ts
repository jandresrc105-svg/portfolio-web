/**
 * Franja emisiva de una escena de referencia para el mapa de entorno.
 */
export interface EnvironmentPanel {
  /** Color. */
  readonly color: number;
  /** Brillo (multiplica el color; > 1 es HDR). */
  readonly glow: number;
  /** Ancho. */
  readonly width: number;
  /** Alto. */
  readonly height: number;
  /** Posición en x. */
  readonly x: number;
  /** Posición en y. */
  readonly y: number;
  /** Posición en z. */
  readonly z: number;
  /** Giro alrededor del eje vertical. */
  readonly rotationY: number;
  /** Giro alrededor del eje x. */
  readonly rotationX: number;
}
