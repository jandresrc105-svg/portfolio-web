/**
 * Ritmo de dibujo parejo cerca de 60 fps. Mide todo el tiempo la frecuencia real de la pantalla y, si es alta
 * (120, 144, 240 Hz), dibuja uno de cada N refrescos: la animación se ve igual de fluida (el paso es constante,
 * sin tirones) y la GPU trabaja la mitad o menos. En pantallas de 60 Hz dibuja todos. La frecuencia se estima con
 * los intervalos más cortos de cada tanda (percentil bajo): un frame lento alarga su intervalo, pero ninguno
 * puede llegar antes que el refresco, así que la carga inicial o un tirón no engañan la medición.
 *
 * Si la CPU no alcanza para ese ritmo (un equipo lento: la mayoría de los frames se come casi todo el
 * intervalo), unos frames entrarían a tiempo y otros perderían el refresco: 16 y 33 ms alternados se ven como
 * tirones. En ese caso dibuja a la mitad del ritmo, parejo, y vuelve al ritmo completo cuando el costo baja con
 * margen. La decisión es por tiempo (desde el último dibujo), no por cantidad de refrescos: un frame que se pasa
 * de su refresco no corre el siguiente.
 */
export class FramePacer {
  private static readonly TARGET_FPS = 60;
  private static readonly SAMPLES = 120;
  private static readonly PERCENTILE = 0.1;
  private static readonly TOLERANCE = 0.15;
  private static readonly MS_PER_SECOND = 1000;
  private static readonly HALF_RATE = 2;
  private static readonly EARLY = 0.5;
  private static readonly LOAD = { samples: 45, percentile: 0.75, heavy: 0.85, light: 0.55 };

  private readonly intervals: number[] = [];
  private readonly costs: number[] = [];
  private last = -1;
  private lastDraw = -1;
  private refresh = FramePacer.MS_PER_SECOND / FramePacer.TARGET_FPS;
  private every = 1;
  private idle = false;
  private overloaded = false;

  /**
   * Si dibuja a la mitad del ritmo porque la CPU no alcanza.
   *
   * @returns `true` si está sobrecargado.
   */
  public get halved(): boolean {
    return this.overloaded;
  }

  /**
   * Decide si este refresco se dibuja.
   *
   * @param timestamp Marca de tiempo del refresco (ms).
   * @returns `true` si hay que dibujar.
   */
  public shouldDraw(timestamp: number): boolean {
    this.measure(timestamp);
    const slow = this.idle || this.overloaded ? FramePacer.HALF_RATE : 1;
    const interval = this.every * slow * this.refresh;
    if (this.lastDraw >= 0 && timestamp - this.lastDraw < interval - this.refresh * FramePacer.EARLY) {
      return false;
    }
    this.lastDraw = timestamp;
    return true;
  }

  /**
   * Modo reposo: sin nadie interactuando, dibuja a la mitad del ritmo (unos 30 fps); lo que se anima sigue
   * viéndose suave y la GPU descansa. Al volver la interacción, el ritmo completo vuelve en el frame siguiente.
   *
   * @param idle `true` para reposo.
   */
  public setIdle(idle: boolean): void {
    this.idle = idle;
  }

  /**
   * Anota cuánto tardó la CPU en un frame dibujado y, con cada tanda, decide si el ritmo completo alcanza: pasa
   * a la mitad si los frames típicos (percentil 75) se comen casi todo el intervalo, y vuelve cuando caben con
   * holgura (la diferencia entre los dos umbrales evita que alterne).
   *
   * @param milliseconds Tiempo de CPU del frame.
   */
  public record(milliseconds: number): void {
    const { samples, percentile, heavy, light } = FramePacer.LOAD;
    this.costs.push(milliseconds);
    if (this.costs.length < samples) {
      return;
    }
    const sorted = this.costs.splice(0).sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length * percentile)] ?? 0;
    const budget = this.every * this.refresh;
    this.overloaded = this.overloaded ? typical > budget * light : typical > budget * heavy;
  }

  /**
   * Junta los intervalos entre refrescos y, con cada tanda completa, fija el refresco y cada cuántos se dibuja.
   *
   * @param timestamp Marca de tiempo del refresco (ms).
   */
  private measure(timestamp: number): void {
    if (this.last >= 0) {
      this.intervals.push(timestamp - this.last);
    }
    this.last = timestamp;
    if (this.intervals.length < FramePacer.SAMPLES) {
      return;
    }
    const sorted = this.intervals.splice(0).sort((a, b) => a - b);
    const shortest = sorted[Math.floor(sorted.length * FramePacer.PERCENTILE)] ?? 0;
    this.refresh = shortest > 0 ? shortest : FramePacer.MS_PER_SECOND / FramePacer.TARGET_FPS;
    const hertz = FramePacer.MS_PER_SECOND / this.refresh;
    this.every = Math.max(1, Math.floor(hertz / FramePacer.TARGET_FPS + FramePacer.TOLERANCE));
  }
}
