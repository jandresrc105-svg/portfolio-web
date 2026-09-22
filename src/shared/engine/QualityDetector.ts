import type { QualityProfile } from './QualityProfile';

/**
 * Detecta la capacidad del dispositivo y elige un perfil de calidad (patrón Strategy por perfiles).
 */
export class QualityDetector {
  private static readonly MIN_DESKTOP_WIDTH = 900;
  private static readonly MIN_CORES = 4;

  private static readonly HIGH: QualityProfile = {
    tier: 'high',
    pixelRatio: 2,
    multisampling: 2,
    reflections: true,
    rainDrops: 6000,
  };

  private static readonly LOW: QualityProfile = {
    tier: 'low',
    pixelRatio: 1.5,
    multisampling: 0,
    reflections: false,
    rainDrops: 2200,
  };

  /**
   * Indica si el navegador soporta WebGL2.
   *
   * @returns `true` si hay soporte.
   */
  public supportsWebGl(): boolean {
    return document.createElement('canvas').getContext('webgl2') !== null;
  }

  /**
   * Elige el perfil de calidad para este dispositivo.
   *
   * @returns Perfil de calidad.
   */
  public detect(): QualityProfile {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth < QualityDetector.MIN_DESKTOP_WIDTH;
    const weak = navigator.hardwareConcurrency < QualityDetector.MIN_CORES;
    return touch || narrow || weak ? QualityDetector.LOW : QualityDetector.HIGH;
  }

  /**
   * Indica si el usuario pidió reducir el movimiento.
   *
   * @returns `true` si prefiere movimiento reducido.
   */
  public prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
