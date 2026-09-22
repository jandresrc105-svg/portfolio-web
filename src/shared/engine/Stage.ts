import {
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
  type Material,
} from 'three';
import { PostProcessing } from './PostProcessing';
import type { QualityProfile } from './QualityProfile';
import { RenderLayer } from './RenderLayer';

/**
 * Escenario 3D: renderer, escena, cámara y post-procesado, con manejo de tamaño.
 */
export class Stage {
  private static readonly FOV = 38;
  private static readonly NEAR = 0.1;
  private static readonly FAR = 220;
  private static readonly MAX_PIXEL_RATIO = 2;

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
    this.camera.layers.enable(RenderLayer.Background);
    this.post = new PostProcessing(this.renderer, this.scene, this.camera, quality);
  }

  /**
   * Máximo filtrado anisotrópico que soporta la GPU.
   *
   * @returns Nivel de anisotropía.
   */
  public get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  /**
   * Ajusta renderer, cámara y post-procesado al tamaño del contenedor.
   *
   * @param width Ancho en píxeles CSS.
   * @param height Alto en píxeles CSS.
   */
  public resize(width: number, height: number): void {
    this.size = { width, height };
    const base = Math.min(window.devicePixelRatio, this.quality.pixelRatio);
    this.renderer.setPixelRatio(Math.min(base * this.resolutionScale, Stage.MAX_PIXEL_RATIO));
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
   * Compila los shaders y sube las texturas a la GPU antes de mostrar la escena,
   * para que esos costos no aparezcan como tirones durante la intro.
   *
   * @returns Promesa que se resuelve cuando la compilación termina.
   */
  public async warmUp(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera);
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Points) {
        Stage.textures(object.material as Material | Material[]).forEach((texture) => {
          this.renderer.initTexture(texture);
        });
      }
    });
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

  /**
   * Texturas usadas por uno o varios materiales.
   *
   * @param material Material o lista de materiales.
   * @returns Texturas encontradas en sus propiedades.
   */
  private static textures(material: Material | Material[]): Texture[] {
    return (Array.isArray(material) ? material : [material]).flatMap((item) =>
      Object.values(item).filter((value): value is Texture => value instanceof Texture),
    );
  }
}
