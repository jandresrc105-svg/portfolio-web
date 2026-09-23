/**
 * Herramientas colgadas en la pared del taller (el valor es el id de su control).
 */
export enum ToolId {
  /** Calibrador digital (vernier). */
  Caliper = 'tool-caliper',
  /** Alicate de corte diagonal. */
  Cutter = 'tool-cutter',
  /** Pinza de puntas. */
  NeedleNose = 'tool-needle-nose',
  /** Pelacables con muescas calibradas. */
  Stripper = 'tool-stripper',
  /** Crimpadora de terminales. */
  Crimper = 'tool-crimper',
  /** Pinza de electrónica. */
  Tweezers = 'tool-tweezers',
  /** Destornillador plano. */
  FlatDriver = 'tool-flat-driver',
  /** Destornillador de estrella. */
  CrossDriver = 'tool-cross-driver',
  /** Destornillador de precisión. */
  PrecisionDriver = 'tool-precision-driver',
  /** Rollo de estaño. */
  Solder = 'tool-solder',
  /** Cinta aislante. */
  Tape = 'tool-tape',
  /** Succionador de estaño. */
  DesolderPump = 'tool-desolder-pump',
}
