import type { Vector3Like } from 'three';

/**
 * Configuración de un letrero de neón.
 */
export interface NeonSignOptions {
  /** Líneas de texto, de arriba hacia abajo. */
  readonly lines: readonly { readonly text: string; readonly size: number; readonly font: string }[];
  /** Color del tubo de neón (CSS). */
  readonly color: string;
  /** Color de la luz que proyecta sobre la escena. */
  readonly lightColor: number;
  /** Ancho y alto del letrero en metros. */
  readonly size: { readonly width: number; readonly height: number };
  /** Posición del centro del letrero. */
  readonly position: Vector3Like;
  /** Rotación en Y (radianes). */
  readonly rotationY: number;
  /** Intensidad de la luz proyectada. */
  readonly lightIntensity: number;
}
