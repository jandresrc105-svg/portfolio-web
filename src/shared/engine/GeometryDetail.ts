/**
 * Niveles de detalle (número de segmentos) para geometrías curvas.
 * Centraliza el balance entre suavidad y costo de GPU.
 */
export enum GeometryDetail {
  /** Cables delgados: la sección casi no se ve. */
  Wire = 5,
  /** Sondas y anillos finos. */
  Thin = 6,
  /** Volúmenes invisibles de colisión. */
  Hitbox = 8,
  /** Perillas y postes pequeños. */
  Low = 12,
  /** Tapas y cilindros medianos. */
  Medium = 16,
  /** Superficies redondas visibles de cerca. */
  High = 24,
  /** Curvas de cables largos. */
  Curve = 32,
  /** Curvas cortas muy visibles. */
  Smooth = 40,
  /** Anillos grandes y brillantes. */
  Ring = 48,
}
