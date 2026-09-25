/**
 * Banda del código de colores de una resistencia.
 */
export interface ResistorBand {
  /** Nombre del color en español. */
  readonly name: string;
  /** Color para pintar la banda. */
  readonly color: number;
  /** Si es una banda metálica (oro o plata). */
  readonly metallic: boolean;
}
