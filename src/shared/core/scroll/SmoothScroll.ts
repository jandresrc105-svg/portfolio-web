import { gsap } from 'gsap';
import Lenis from 'lenis';

/**
 * Scroll suave de la página (Lenis) sincronizado con el ticker de GSAP.
 * Publica el progreso de scroll normalizado [0, 1] a sus suscriptores (patrón Observer).
 */
export class SmoothScroll {
  private static readonly LERP = 0.085;
  private static readonly MS_PER_SECOND = 1000;
  private static readonly NAVIGATION_SECONDS = 2.2;

  private lenis: Lenis | null = null;
  private readonly listeners = new Set<(progress: number) => void>();

  /**
   * Progreso actual del scroll.
   *
   * @returns Valor entre 0 (inicio) y 1 (final).
   */
  public get progress(): number {
    return this.lenis?.progress ?? 0;
  }

  /**
   * Inicia el scroll suave. Llamarlo más de una vez no tiene efecto.
   */
  public start(): void {
    if (this.lenis) {
      return;
    }
    this.lenis = new Lenis({ lerp: SmoothScroll.LERP });
    window.addEventListener(
      'scroll',
      () => {
        this.notify(SmoothScroll.nativeProgress());
      },
      { passive: true },
    );
    gsap.ticker.add(this.tick);
    gsap.ticker.lagSmoothing(0);
  }

  /**
   * Suscribe un manejador al progreso del scroll.
   *
   * @param listener Recibe el progreso normalizado.
   * @returns Función que cancela la suscripción.
   */
  public onProgress(listener: (progress: number) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Bloquea el scroll del usuario (por ejemplo durante la intro).
   */
  public lock(): void {
    this.lenis?.stop();
  }

  /**
   * Desbloquea el scroll del usuario.
   */
  public unlock(): void {
    this.lenis?.start();
  }

  /**
   * Desplaza la página hasta la sección indicada.
   *
   * @param id Id del elemento destino.
   */
  public scrollTo(id: string): void {
    this.lenis?.scrollTo(`#${id}`, { duration: SmoothScroll.NAVIGATION_SECONDS });
  }

  /**
   * Avanza Lenis en cada frame del ticker de GSAP.
   *
   * @param time Tiempo del ticker en segundos.
   */
  private readonly tick = (time: number): void => {
    this.lenis?.raf(time * SmoothScroll.MS_PER_SECOND);
  };

  /**
   * Notifica el progreso a los suscriptores.
   *
   * @param progress Progreso normalizado.
   */
  private notify(progress: number): void {
    this.listeners.forEach((listener) => {
      listener(progress);
    });
  }

  /**
   * Progreso calculado desde la posición real del documento. Se usa el evento nativo porque
   * también se dispara con anclas, teclado o `scrollIntoView`, no solo con el scroll animado de Lenis.
   *
   * @returns Progreso normalizado [0, 1].
   */
  private static nativeProgress(): number {
    const limit = document.documentElement.scrollHeight - window.innerHeight;
    return limit > 0 ? window.scrollY / limit : 0;
  }
}
