import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
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
 * Cadena de post-procesado cinematográfico: bloom (neón), tone mapping, y en una sola pasada
 * antialiasing SMAA, viñeta y grano. Se usa SMAA en lugar de MSAA porque en GPUs integradas
 * el MSAA sobre buffers HDR puede costar la mitad del frame.
 */
export class PostProcessing {
  private static readonly BLOOM = { intensity: 2.1, threshold: 0.42, smoothing: 0.3, radius: 0.82 };
  private static readonly VIGNETTE = { offset: 0.28, darkness: 0.78 };
  private static readonly GRAIN_OPACITY = 0.045;

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
      new EffectPass(camera, PostProcessing.bloom(), new ToneMappingEffect({ mode: ToneMappingMode.AGX })),
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
   * Efectos de lente aplicados después del tone mapping, en la misma pasada que el antialiasing.
   *
   * @returns Viñeta y grano.
   */
  private static lens(): [VignetteEffect, NoiseEffect] {
    const vignette = new VignetteEffect(PostProcessing.VIGNETTE);
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = PostProcessing.GRAIN_OPACITY;
    return [vignette, grain];
  }
}
