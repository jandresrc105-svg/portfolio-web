import type { QualityProfile } from './QualityProfile';

/**
 * Detecta la capacidad del dispositivo y elige un perfil de calidad (patrón Strategy por perfiles).
 */
export class QualityDetector {
  private static readonly MIN_DESKTOP_WIDTH = 900;
  private static readonly MIN_CORES = 4;
  private static readonly MAX_PIXEL_RATIO = 2;

  private static readonly HIGH: QualityProfile = {
    tier: 'high',
    pixelRatio: 2,
    multisampling: 0,
    smaa: true,
    reflections: true,
    rainDrops: 6000,
    splashes: 420,
    buildings: 260,
    maxResolutionScale: 1.5,
    minResolutionScale: 1,
    textureScale: 2,
  };

  private static readonly LOW: QualityProfile = {
    tier: 'low',
    pixelRatio: 1.5,
    multisampling: 0,
    smaa: true,
    reflections: false,
    rainDrops: 2200,
    splashes: 160,
    buildings: 140,
    maxResolutionScale: 1,
    minResolutionScale: 0.7,
    textureScale: 1.5,
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
   * Elige el perfil de calidad para este dispositivo. La resolución de las texturas de canvas no pasa de la
   * densidad máxima a la que se renderiza la escena en esta pantalla: más texeles que píxeles no se ven más
   * nítidos y solo ocupan memoria (en una pantalla 1x ahorra casi la mitad; en una retina no cambia nada).
   *
   * @returns Perfil de calidad.
   */
  public detect(): QualityProfile {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.innerWidth < QualityDetector.MIN_DESKTOP_WIDTH;
    const weak = navigator.hardwareConcurrency < QualityDetector.MIN_CORES;
    const profile = touch || narrow || weak ? QualityDetector.LOW : QualityDetector.HIGH;
    const base = Math.min(window.devicePixelRatio, profile.pixelRatio);
    const density = Math.min(base * profile.maxResolutionScale, QualityDetector.MAX_PIXEL_RATIO);
    return { ...profile, textureScale: Math.min(profile.textureScale, Math.max(density, 1)) };
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
