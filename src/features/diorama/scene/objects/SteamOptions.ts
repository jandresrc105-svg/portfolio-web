import type { Vector3Like } from 'three';

/**
 * Configuración de una columna de vapor.
 */
export interface SteamOptions {
  /** Punto de donde sale el vapor. */
  readonly origin: Vector3Like;
  /** Número de volutas. */
  readonly count: number;
  /** Altura que alcanza antes de desvanecerse, en metros. */
  readonly height: number;
  /** Ciclos de vida por segundo. */
  readonly speed: number;
  /** Apertura horizontal de la columna, en metros. */
  readonly spread: number;
  /** Tamaño de cada voluta, en metros. */
  readonly size: number;
  /** Opacidad máxima. */
  readonly opacity: number;
}
