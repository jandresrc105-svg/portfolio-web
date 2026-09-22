import { Timer, type WebGLRenderer } from 'three';
import type { Updatable } from './Updatable';

/**
 * Bucle de render: notifica a los {@link Updatable} suscritos y luego dibuja el frame.
 */
export class RenderLoop {
  private static readonly MIN_FPS = 20;

  private readonly subscribers = new Set<Updatable>();
  private readonly timer = new Timer();

  /**
   * Crea el bucle.
   *
   * @param renderer Renderer que provee `setAnimationLoop`.
   * @param draw Función que dibuja el frame.
   */
  public constructor(
    private readonly renderer: WebGLRenderer,
    private readonly draw: () => void,
  ) {}

  /**
   * Suscribe objetos al bucle.
   *
   * @param updatables Objetos a actualizar en cada frame.
   */
  public add(...updatables: Updatable[]): void {
    updatables.forEach((updatable) => this.subscribers.add(updatable));
  }

  /**
   * Inicia el bucle.
   */
  public start(): void {
    this.renderer.setAnimationLoop((timestamp) => {
      this.tick(timestamp);
    });
  }

  /**
   * Detiene el bucle y libera el temporizador.
   */
  public stop(): void {
    this.renderer.setAnimationLoop(null);
    this.timer.dispose();
  }

  /**
   * Ejecuta un frame.
   *
   * @param timestamp Marca de tiempo del navegador en milisegundos.
   */
  private tick(timestamp: number): void {
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 1 / RenderLoop.MIN_FPS);
    const elapsed = this.timer.getElapsed();
    this.subscribers.forEach((updatable) => {
      updatable.update(delta, elapsed);
    });
    this.draw();
  }
}
