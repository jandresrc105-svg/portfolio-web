/**
 * Ritmo de dibujo parejo cerca de 60 fps. Mide todo el tiempo la frecuencia real de la pantalla y, si es alta
 * (120, 144, 240 Hz), dibuja uno de cada N refrescos: la animación se ve igual de fluida (el paso es constante,
 * sin tirones) y la GPU trabaja la mitad o menos. En pantallas de 60 Hz dibuja todos. La frecuencia se estima con
 * los intervalos más cortos de cada tanda (percentil bajo): un frame lento alarga su intervalo, pero ninguno
 * puede llegar antes que el refresco, así que la carga inicial o un tirón no engañan la medición.
 */
export class FramePacer {
  private static readonly TARGET_FPS = 60;
  private static readonly SAMPLES = 120;
  private static readonly PERCENTILE = 0.1;
  private static readonly TOLERANCE = 0.15;
  private static readonly MS_PER_SECOND = 1000;
  private static readonly IDLE_FACTOR = 2;

  private readonly intervals: number[] = [];
  private last = -1;
  private every = 1;
  private frame = 0;
  private idle = false;

  /**
   * Decide si este refresco se dibuja.
   *
   * @param timestamp Marca de tiempo del refresco (ms).
   * @returns `true` si hay que dibujar.
   */
  public shouldDraw(timestamp: number): boolean {
    this.measure(timestamp);
    this.frame += 1;
    return this.frame % (this.idle ? this.every * FramePacer.IDLE_FACTOR : this.every) === 0;
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
   * Junta los intervalos entre refrescos y, con cada tanda completa, fija cada cuántos se dibuja.
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
    const hertz = shortest > 0 ? FramePacer.MS_PER_SECOND / shortest : FramePacer.TARGET_FPS;
    this.every = Math.max(1, Math.floor(hertz / FramePacer.TARGET_FPS + FramePacer.TOLERANCE));
  }
}
