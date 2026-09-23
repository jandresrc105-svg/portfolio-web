/**
 * Trozo de una línea de código con el color de su categoría.
 */
export interface CodeToken {
  /** Texto. */
  readonly text: string;
  /** Color CSS. */
  readonly color: string;
}
