import type { CanEmblem } from './CanEmblem';

/**
 * "Sabor" de una lata de la máquina: la tecnología que representa y el diseño de su etiqueta.
 */
export interface CanFlavor {
  /** Identificador usado en `sections.json` (`"can": "typescript"`). */
  readonly id: string;
  /** Nombre impreso bajo el emblema. */
  readonly name: string;
  /** Siglas que usan los emblemas con texto (vacío si el emblema es solo un dibujo). */
  readonly glyph: string;
  /** Dibujo del emblema. */
  readonly emblem: CanEmblem;
  /** Color principal de la lata (arriba). */
  readonly base: string;
  /** Color de la lata abajo, para el degradado. */
  readonly shade: string;
  /** Color de acento (franja diagonal y detalles del emblema). */
  readonly accent: string;
  /** Color del emblema y del nombre. */
  readonly ink: string;
}
