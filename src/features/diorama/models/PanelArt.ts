/**
 * Serigrafía de un panel frontal: textos, anillos de color y marcos de grupo. Las posiciones van en
 * metros desde el centro del panel (+x a la derecha, +y hacia arriba), las mismas que usan las piezas 3D,
 * para que todo quede alineado.
 */
export interface PanelArt {
  /** Textos impresos. */
  readonly labels: readonly {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    /** Alto de la letra en metros. */
    readonly size: number;
    readonly color: string;
    /** Peso tipográfico (400 normal, 700 negrita). */
    readonly weight: number;
    readonly align: CanvasTextAlign;
  }[];
  /** Anillos de color (alrededor de conectores o botones). */
  readonly rings: readonly {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly color: string;
  }[];
  /** Marcos que agrupan controles. */
  readonly frames: readonly {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly color: string;
  }[];
}
