/**
 * Datos de la trayectoria que necesita el tablero del poste: la etiqueta de cada breaker (una etapa, en
 * orden cronológico), los sellos de inspección pegados en la puerta (certificaciones) y desde cuándo corre
 * el medidor de energía (inicio de la experiencia laboral).
 */
export interface TimelineDirectory {
  /** Etiqueta corta de cada breaker, en el orden de las etapas ("UQ", "ESP32"…). */
  readonly breakers: readonly string[];
  /** Texto de cada sello de inspección ("NVIDIA 2022"). */
  readonly seals: readonly string[];
  /** Fecha ISO desde la que cuenta el medidor de energía (`2024-07-01`), o vacía si no aplica. */
  readonly since: string;
}
