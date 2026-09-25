/**
 * Componente montado en la placa. Posición y medidas en metros sobre la cara superior de la placa, desde su
 * centro (+x a la derecha, +z hacia el frente).
 */
export interface BoardPart {
  /** Tipo de encapsulado. */
  readonly kind:
    | 'qfp'
    | 'soic'
    | 'sot'
    | 'crystal'
    | 'capacitor'
    | 'header'
    | 'usb'
    | 'terminal'
    | 'led'
    | 'passive'
    | 'testpoint';
  /** Centro horizontal. */
  readonly x: number;
  /** Centro en profundidad. */
  readonly z: number;
  /** Ancho (a lo largo de x). */
  readonly width: number;
  /** Profundidad (a lo largo de z). */
  readonly depth: number;
  /** Designador serigrafiado (U1, C2…). */
  readonly label?: string;
}
