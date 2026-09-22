/**
 * Parámetros de calidad gráfica según la capacidad del dispositivo.
 */
export interface QualityProfile {
  /** Nivel de calidad. */
  readonly tier: 'high' | 'low';
  /** Relación de píxeles máxima del renderer. */
  readonly pixelRatio: number;
  /** Muestras de antialiasing del post-procesado (0 = desactivado). */
  readonly multisampling: number;
  /** Habilita reflejos planares (charcos). */
  readonly reflections: boolean;
  /** Número de gotas de lluvia. */
  readonly rainDrops: number;
}
