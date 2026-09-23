/**
 * Texto serigrafiado en un frente o en una placa, en metros desde su centro (+y arriba).
 */
export interface RadioLabel {
  /** Texto. */
  readonly text: string;
  /** Posición horizontal en metros. */
  readonly x: number;
  /** Posición vertical en metros. */
  readonly y: number;
  /** Alto de la letra en píxeles del canvas. */
  readonly size: number;
}
