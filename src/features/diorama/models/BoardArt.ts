/**
 * Arte de una placa de circuito: pistas de cobre, pads, contornos y textos de serigrafía y agujeros de
 * montaje. Coordenadas en metros sobre la cara superior, desde el centro (+x a la derecha, +z al frente).
 */
export interface BoardArt {
  /** Pistas: polilíneas con su ancho. */
  readonly traces: readonly {
    readonly points: readonly { readonly x: number; readonly z: number }[];
    readonly width: number;
  }[];
  /** Pads dorados rectangulares. */
  readonly pads: readonly {
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
  }[];
  /** Contornos de serigrafía alrededor de los componentes. */
  readonly outlines: readonly {
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
  }[];
  /** Textos de serigrafía. */
  readonly labels: readonly {
    readonly text: string;
    readonly x: number;
    readonly z: number;
    readonly size: number;
  }[];
  /** Agujeros de montaje con anillo dorado. */
  readonly holes: readonly { readonly x: number; readonly z: number; readonly radius: number }[];
}
