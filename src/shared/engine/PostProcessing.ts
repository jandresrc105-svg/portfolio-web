import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { HalfFloatType, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { QualityProfile } from './QualityProfile';

/**
 * Cadena de post-procesado: bloom (solo lo que de verdad emite luz, como el neón), tone mapping ACES para
 * negros profundos y contraste limpio, y en una sola pasada antialiasing SMAA y una viñeta suave.
 * Se usa SMAA en lugar de MSAA porque en GPUs integradas el MSAA sobre buffers HDR puede costar la mitad
 * del frame. Un bloom con umbral bajo o un tone mapping plano (AgX) dejan la imagen empañada.
 */
export class PostProcessing {
  private static readonly BLOOM = { intensity: 1.3, threshold: 0.9, smoothing: 0.15, radius: 0.6 };
  private static readonly VIGNETTE = { offset: 0.3, darkness: 0.62 };

  private readonly composer: EffectComposer;

  /**
   * Crea la cadena de efectos.
   *
   * @param renderer Renderer WebGL.
   * @param scene Escena a renderizar.
   * @param camera Cámara activa.
   * @param quality Perfil de calidad.
   */
  public constructor(renderer: WebGLRenderer, scene: Scene, camera: Camera, quality: QualityProfile) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: HalfFloatType,
      multisampling: quality.multisampling,
    });
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(
      new EffectPass(
        camera,
        PostProcessing.bloom(),
        new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
      ),
    );
    const antialias = quality.smaa ? [new SMAAEffect({ preset: SMAAPreset.MEDIUM })] : [];
    this.composer.addPass(new EffectPass(camera, ...antialias, ...PostProcessing.lens()));
  }

  /**
   * Dibuja un frame con los efectos.
   */
  public render(): void {
    this.composer.render();
  }

  /**
   * Ajusta el tamaño de los buffers.
   *
   * @param width Ancho en píxeles CSS.
   * @param height Alto en píxeles CSS.
   */
  public setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /**
   * Libera los buffers.
   */
  public dispose(): void {
    this.composer.dispose();
  }

  /**
   * Bloom con desenfoque mip para halos amplios y suaves.
   *
   * @returns Efecto de bloom.
   */
  private static bloom(): BloomEffect {
    const { intensity, threshold, smoothing, radius } = PostProcessing.BLOOM;
    return new BloomEffect({
      mipmapBlur: true,
      intensity,
      radius,
      luminanceThreshold: threshold,
      luminanceSmoothing: smoothing,
    });
  }

  /**
   * Efecto de lente aplicado después del tone mapping, en la misma pasada que el antialiasing. Sin grano:
   * la imagen queda limpia.
   *
   * @returns Viñeta.
   */
  private static lens(): [VignetteEffect] {
    return [new VignetteEffect(PostProcessing.VIGNETTE)];
  }
}
