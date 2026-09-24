import { Timer, type WebGLRenderer } from 'three';
import { FramePacer } from './FramePacer';
import type { Updatable } from './Updatable';

/**
 * Bucle de render: notifica a los {@link Updatable} suscritos y luego dibuja el frame, a un ritmo parejo
 * cercano a 60 fps aunque la pantalla refresque más rápido ({@link FramePacer}). Con la pestaña oculta el
 * navegador deja de pedir frames y el bucle se detiene solo. Tras unos segundos sin interacción entra en
 * reposo (la mitad del ritmo) hasta el siguiente {@link RenderLoop.wake}. Cada frame dibujado le informa al
 * {@link FramePacer} cuánto costó, para que baje a la mitad del ritmo, parejo, si la CPU no alcanza.
 */
export class RenderLoop {
  private static readonly MIN_FPS = 20;
  private static readonly IDLE_SECONDS = 6;

  private readonly subscribers = new Set<Updatable>();
  private readonly timer = new Timer();
  private readonly pacer = new FramePacer();
  private idleFor = 0;

  /**
   * Crea el bucle.
   *
   * @param renderer Renderer que provee `setAnimationLoop`.
   * @param draw Función que dibuja el frame.
   * @param stats Medición de rendimiento de cada frame dibujado (opcional).
   */
  public constructor(
    private readonly renderer: WebGLRenderer,
    private readonly draw: () => void,
    private readonly stats: { beginFrame: () => void; endFrame: () => void } | null = null,
  ) {}

  /**
   * Si el bucle está en reposo (dibujando a la mitad del ritmo por falta de interacción).
   *
   * @returns `true` en reposo.
   */
  public get resting(): boolean {
    return this.idleFor > RenderLoop.IDLE_SECONDS;
  }

  /**
   * Si dibuja a la mitad del ritmo, en reposo o porque la CPU no alcanza para el ritmo completo. En ese caso los
   * frames tardan el doble a propósito y no indican que falte GPU.
   *
   * @returns `true` si va a la mitad del ritmo.
   */
  public get halved(): boolean {
    return this.resting || this.pacer.halved;
  }

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
   * Avisa que hay interacción (puntero, teclado, cámara en movimiento): sale del modo reposo.
   */
  public wake(): void {
    this.idleFor = 0;
    this.pacer.setIdle(false);
  }

  /**
   * Ejecuta un frame.
   *
   * @param timestamp Marca de tiempo del navegador en milisegundos.
   */
  private tick(timestamp: number): void {
    if (!this.pacer.shouldDraw(timestamp)) {
      return;
    }
    const start = performance.now();
    this.stats?.beginFrame();
    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 1 / RenderLoop.MIN_FPS);
    this.idleFor += delta;
    this.pacer.setIdle(this.idleFor > RenderLoop.IDLE_SECONDS);
    const elapsed = this.timer.getElapsed();
    this.subscribers.forEach((updatable) => {
      updatable.update(delta, elapsed);
    });
    this.draw();
    this.stats?.endFrame();
    this.pacer.record(performance.now() - start);
  }
}
