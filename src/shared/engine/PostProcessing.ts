import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { HalfFloatType, Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import type { QualityProfile } from './QualityProfile';

/**
 * Cadena de post-procesado cinematográfico: bloom (neón), tone mapping, aberración cromática, viñeta y grano.
 */
export class PostProcessing {
  private static readonly BLOOM = { intensity: 2.1, threshold: 0.42, smoothing: 0.3, radius: 0.82 };
  private static readonly VIGNETTE = { offset: 0.28, darkness: 0.78 };
  private static readonly GRAIN_OPACITY = 0.07;
  private static readonly ABERRATION = 0.00055;

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
    this.composer.addPass(new EffectPass(camera, ...PostProcessing.lens()));
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
   * Efectos de lente aplicados después del tone mapping.
   *
   * @returns Aberración cromática, viñeta y grano.
   */
  private static lens(): [ChromaticAberrationEffect, VignetteEffect, NoiseEffect] {
    const aberration = new ChromaticAberrationEffect({
      offset: new Vector2(PostProcessing.ABERRATION, PostProcessing.ABERRATION),
      radialModulation: true,
      modulationOffset: 0.3,
    });
    const vignette = new VignetteEffect(PostProcessing.VIGNETTE);
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = PostProcessing.GRAIN_OPACITY;
    return [aberration, vignette, grain];
  }
}
