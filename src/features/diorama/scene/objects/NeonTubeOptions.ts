/**
 * Medidas y color de un tubo de neón con forma de rectángulo redondeado.
 */
export interface NeonTubeOptions {
  /** Ancho exterior del rectángulo, en metros. */
  width: number;
  /** Alto exterior del rectángulo, en metros. */
  height: number;
  /** Radio de las esquinas, en metros. */
  corner: number;
  /** Grosor (radio) del tubo, en metros. */
  thickness: number;
  /** Color del gas encendido. */
  color: number;
  /** Multiplicador de brillo encendido (por encima de 1 activa el bloom). */
  glow: number;
}
