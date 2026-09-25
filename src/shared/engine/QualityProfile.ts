/**
 * Parámetros de calidad gráfica según la capacidad del dispositivo.
 */
export interface QualityProfile {
  /** Nivel de calidad. */
  readonly tier: 'high' | 'low';
  /** Relación de píxeles máxima del renderer. */
  readonly pixelRatio: number;
  /** Muestras de antialiasing MSAA del post-procesado (0 = desactivado; costoso en GPUs integradas). */
  readonly multisampling: number;
  /** Antialiasing SMAA por post-procesado (barato). */
  readonly smaa: boolean;
  /** Habilita reflejos planares (charcos). */
  readonly reflections: boolean;
  /** Número de gotas de lluvia. */
  readonly rainDrops: number;
  /** Número de salpicaduras de lluvia simultáneas sobre el suelo. */
  readonly splashes: number;
  /** Número de edificios de la ciudad de fondo. */
  readonly buildings: number;
  /** Escala máxima de resolución interna (> 1 = supersampling si los FPS lo permiten). */
  readonly maxResolutionScale: number;
  /** Escala mínima de resolución interna: por debajo de 1 la imagen se ve borrosa. */
  readonly minResolutionScale: number;
  /** Factor de resolución de las texturas dibujadas en canvas. */
  readonly textureScale: number;
}
