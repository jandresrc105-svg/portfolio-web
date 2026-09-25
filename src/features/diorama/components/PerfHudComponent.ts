import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { PerfSnapshot } from '@shared/engine/PerfSnapshot';

/**
 * Medidor de rendimiento en pantalla (se muestra con `?perf` en la URL): fps, milisegundos de CPU y de GPU por
 * frame, draw calls, triángulos, shaders, memoria de la GPU, tamaño del render y nombre de la GPU. Sirve para
 * medir en un teléfono real lo que no se puede emular en el computador.
 */
export class PerfHudComponent extends Component {
  private static readonly REFRESH_MS = 500;
  private static readonly THOUSAND = 1000;
  private static readonly DECIMALS = 1;

  private readonly lines = ElementBuilder.create('pre').classes('perf-hud__lines').build();
  private source: (() => PerfSnapshot | null) | null = null;
  private timer = 0;

  /**
   * Conecta el medidor con la fuente de las mediciones.
   *
   * @param source Devuelve la medición actual, o `null` si la escena todavía no arranca.
   */
  public connect(source: () => PerfSnapshot | null): void {
    this.source = source;
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    window.clearInterval(this.timer);
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    return ElementBuilder.create('aside')
      .classes('perf-hud')
      .attr('aria-hidden', 'true')
      .children(this.lines)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.timer = window.setInterval(() => {
      this.show(this.source?.() ?? null);
    }, PerfHudComponent.REFRESH_MS);
  }

  /**
   * Escribe la medición.
   *
   * @param snapshot Medición o `null`.
   */
  private show(snapshot: PerfSnapshot | null): void {
    if (!snapshot) {
      this.lines.textContent = 'perf: esperando la escena…';
      return;
    }
    const { fps, cpu, gpu, calls, triangles, programs, memory, canvas, gpuName } = snapshot;
    const digits = PerfHudComponent.DECIMALS;
    this.lines.textContent = [
      `${fps.toFixed(0)} fps · CPU ${cpu.toFixed(digits)} ms · GPU ${gpu === null ? 'n/d' : `${gpu.toFixed(digits)} ms`}`,
      `${String(calls)} draws · ${(triangles / PerfHudComponent.THOUSAND).toFixed(0)}k tris · ${String(programs)} shaders`,
      `${String(memory.textures)} tex · ${String(memory.geometries)} geo`,
      `${String(canvas.width)}×${String(canvas.height)} @${canvas.ratio.toFixed(2)}`,
      gpuName,
    ].join('\n');
  }
}
