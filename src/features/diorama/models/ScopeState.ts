/**
 * Estado del osciloscopio: encendido, adquisición, canales visibles y escalas de la pantalla.
 */
export interface ScopeState {
  /** Si el equipo está encendido. */
  readonly powered: boolean;
  /** Si adquiere continuamente (RUN) o la traza está congelada (STOP). */
  readonly running: boolean;
  /** Si espera un único disparo antes de detenerse (SINGLE). */
  readonly single: boolean;
  /** Si se muestran las mediciones automáticas (MENU). */
  readonly measurements: boolean;
  /** Visibilidad de CH1 (salida) y CH2 (referencia). */
  readonly channels: readonly boolean[];
  /** Índice de la base de tiempo (s/div). */
  readonly timebase: number;
  /** Índice de la escala vertical (V/div). */
  readonly scale: number;
  /** Posición vertical de las trazas, en divisiones. */
  readonly position: number;
}
