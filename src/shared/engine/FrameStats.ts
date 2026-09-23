import type { WebGLRenderer } from 'three';
import type { PerfSnapshot } from './PerfSnapshot';

/**
 * Mide el rendimiento real de cada frame: CPU (lógica y envío a la GPU) con `performance.now`, y GPU con el
 * cronómetro de WebGL (`EXT_disjoint_timer_query_webgl2`, disponible en la mayoría de GPUs de escritorio y de
 * Android). Los resultados de GPU llegan unos frames después, por eso se usa un pequeño grupo de consultas.
 * Todo se promedia de forma exponencial para que el medidor en pantalla se lea estable.
 */
export class FrameStats {
  private static readonly SMOOTHING = 0.1;
  private static readonly QUERIES = 4;
  private static readonly NANOS_PER_MS = 1e6;
  private static readonly MS_PER_SECOND = 1000;
  private static readonly TIMER_EXTENSION = 'EXT_disjoint_timer_query_webgl2' as const;
  private static readonly RENDERER_EXTENSION = 'WEBGL_debug_renderer_info' as const;
  private static readonly TIME_ELAPSED = 0x88bf;
  private static readonly GPU_DISJOINT = 0x8fbb;
  private static readonly UNMASKED_RENDERER = 0x9246;

  private readonly gl: WebGL2RenderingContext;
  private readonly timer: boolean;
  private readonly pending: WebGLQuery[] = [];
  private readonly free: WebGLQuery[] = [];
  private active: WebGLQuery | null = null;
  private started = 0;
  private lastEnd = 0;
  private readonly averages = { cpu: 0, gpu: -1, interval: 0, calls: 0, triangles: 0 };

  /**
   * Prepara la medición.
   *
   * @param renderer Renderer a medir.
   */
  public constructor(private readonly renderer: WebGLRenderer) {
    this.gl = renderer.getContext() as WebGL2RenderingContext;
    this.timer = this.gl.getExtension(FrameStats.TIMER_EXTENSION) !== null;
    renderer.info.autoReset = false;
  }

  /**
   * Empieza un frame dibujado (antes de la lógica).
   */
  public beginFrame(): void {
    this.started = performance.now();
  }

  /**
   * Empieza el trabajo de GPU del frame (antes del primer render).
   */
  public beginGpu(): void {
    this.renderer.info.reset();
    this.collect();
    if (!this.timer || this.active) {
      return;
    }
    const query =
      this.free.pop() ?? (this.pending.length < FrameStats.QUERIES ? this.gl.createQuery() : null);
    if (query) {
      this.gl.beginQuery(FrameStats.TIME_ELAPSED, query);
      this.active = query;
    }
  }

  /**
   * Termina el trabajo de GPU del frame (después del último render).
   */
  public endGpu(): void {
    if (this.timer && this.active) {
      this.gl.endQuery(FrameStats.TIME_ELAPSED);
      this.pending.push(this.active);
      this.active = null;
    }
    const { calls, triangles } = this.renderer.info.render;
    this.averages.calls = this.smooth(this.averages.calls, calls);
    this.averages.triangles = this.smooth(this.averages.triangles, triangles);
  }

  /**
   * Termina un frame dibujado (después del render).
   */
  public endFrame(): void {
    const now = performance.now();
    this.averages.cpu = this.smooth(this.averages.cpu, now - this.started);
    if (this.lastEnd > 0) {
      this.averages.interval = this.smooth(this.averages.interval, now - this.lastEnd);
    }
    this.lastEnd = now;
  }

  /**
   * Medición actual.
   *
   * @returns Promedios de los últimos frames.
   */
  public snapshot(): PerfSnapshot {
    const { cpu, gpu, interval, calls, triangles } = this.averages;
    const canvas = this.renderer.domElement;
    const memory = this.renderer.info.memory;
    return {
      fps: interval > 0 ? FrameStats.MS_PER_SECOND / interval : 0,
      cpu,
      gpu: gpu < 0 ? null : gpu,
      calls: Math.round(calls),
      triangles: Math.round(triangles),
      programs: this.renderer.info.programs?.length ?? 0,
      memory: { textures: memory.textures, geometries: memory.geometries },
      canvas: { width: canvas.width, height: canvas.height, ratio: this.renderer.getPixelRatio() },
      gpuName: this.gpuName(),
    };
  }

  /**
   * Recoge los resultados de GPU que ya estén listos (descarta los de frames interrumpidos).
   */
  private collect(): void {
    if (!this.timer) {
      return;
    }
    const disjoint = this.gl.getParameter(FrameStats.GPU_DISJOINT) as boolean;
    while (this.pending.length > 0) {
      const query = this.pending[0];
      if (!query || !(this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE) as boolean)) {
        return;
      }
      this.pending.shift();
      const nanos = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number;
      if (!disjoint) {
        const ms = nanos / FrameStats.NANOS_PER_MS;
        this.averages.gpu = this.averages.gpu < 0 ? ms : this.smooth(this.averages.gpu, ms);
      }
      this.free.push(query);
    }
  }

  /**
   * Nombre de la GPU (sin enmascarar si el navegador lo permite).
   *
   * @returns Nombre.
   */
  private gpuName(): string {
    const debug = this.gl.getExtension(FrameStats.RENDERER_EXTENSION) !== null;
    const name: unknown = this.gl.getParameter(debug ? FrameStats.UNMASKED_RENDERER : this.gl.RENDERER);
    return typeof name === 'string' ? name : '';
  }

  /**
   * Promedio exponencial.
   *
   * @param average Promedio anterior.
   * @param value Valor nuevo.
   * @returns Promedio actualizado.
   */
  private smooth(average: number, value: number): number {
    return average + (value - average) * FrameStats.SMOOTHING;
  }
}
