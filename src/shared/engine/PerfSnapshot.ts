/**
 * Medición de rendimiento de los últimos frames (promedios), para el medidor en pantalla.
 */
export interface PerfSnapshot {
  /** Frames dibujados por segundo. */
  readonly fps: number;
  /** Milisegundos de CPU por frame dibujado (lógica + envío a la GPU). */
  readonly cpu: number;
  /** Milisegundos de GPU por frame, o `null` si el navegador no expone el cronómetro de GPU. */
  readonly gpu: number | null;
  /** Draw calls por frame (todas las pasadas). */
  readonly calls: number;
  /** Triángulos por frame. */
  readonly triangles: number;
  /** Programas de shader compilados. */
  readonly programs: number;
  /** Texturas y geometrías en la GPU. */
  readonly memory: { readonly textures: number; readonly geometries: number };
  /** Tamaño del buffer de dibujo en píxeles y relación de píxeles. */
  readonly canvas: { readonly width: number; readonly height: number; readonly ratio: number };
  /** Nombre de la GPU que informa el navegador. */
  readonly gpuName: string;
}
