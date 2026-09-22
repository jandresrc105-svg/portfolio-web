import { PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three';
import { PostProcessing } from './PostProcessing';
import type { QualityProfile } from './QualityProfile';

/**
 * Escenario 3D: renderer, escena, cámara y post-procesado, con manejo de tamaño.
 */
export class Stage {
  private static readonly FOV = 38;
  private static readonly NEAR = 0.1;
  private static readonly FAR = 220;

  public readonly scene = new Scene();
  public readonly camera = new PerspectiveCamera(Stage.FOV, 1, Stage.NEAR, Stage.FAR);
  public readonly renderer: WebGLRenderer;

  private readonly post: PostProcessing;
  private size = { width: 1, height: 1 };
  private resolutionScale = 1;

  /**
   * Crea el escenario sobre un canvas.
   *
   * @param canvas Canvas donde se dibuja.
   * @param quality Perfil de calidad.
   */
  public constructor(
    canvas: HTMLCanvasElement,
    private readonly quality: QualityProfile,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.post = new PostProcessing(this.renderer, this.scene, this.camera, quality);
  }

  /**
   * Ajusta renderer, cámara y post-procesado al tamaño del contenedor.
   *
   * @param width Ancho en píxeles CSS.
   * @param height Alto en píxeles CSS.
   */
  public resize(width: number, height: number): void {
    this.size = { width, height };
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.quality.pixelRatio) * this.resolutionScale,
    );
    this.renderer.setSize(width, height, false);
    this.post.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Escala la resolución interna del render (el canvas sigue ocupando la misma área en pantalla).
   *
   * @param scale Factor sobre la relación de píxeles máxima, en (0, 1].
   */
  public setResolutionScale(scale: number): void {
    this.resolutionScale = scale;
    this.resize(this.size.width, this.size.height);
  }

  /**
   * Compila los shaders de la escena para evitar tirones en el primer frame.
   *
   * @returns Promesa que se resuelve cuando la compilación termina.
   */
  public async warmUp(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera);
  }

  /**
   * Dibuja un frame.
   */
  public render(): void {
    this.post.render();
  }

  /**
   * Libera los recursos de GPU del escenario.
   */
  public dispose(): void {
    this.post.dispose();
    this.renderer.dispose();
  }
}
