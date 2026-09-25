/**
 * Medidas del tablero del poste que comparten las piezas 3D y el dibujo del circuito del fondo. Todo en
 * metros, en el espacio del gabinete (origen en su centro, +x a la derecha, +y arriba, +z hacia la calle).
 * La corriente recorre el bus de izquierda a derecha: sale del MAIN, pasa por cada etapa en orden y llega a
 * la carga final ("HOY").
 */
export class PanelLayout {
  public static readonly CABINET = { width: 0.62, height: 0.78, depth: 0.16, wall: 0.014 };
  public static readonly PLATE = { width: 0.58, height: 0.74, lift: 0.002 };
  public static readonly BUS_Y = 0.19;
  public static readonly TITLE_Y = 0.31;
  public static readonly LABEL_Y = -0.115;
  public static readonly STATUS_Y = -0.21;
  public static readonly HINT_Y = -0.3;
  public static readonly NODE = { width: 0.07, height: 0.05 };
  public static readonly BREAKER = { y: -0.03, width: 0.054, height: 0.1, depth: 0.06 };
  public static readonly MAIN = { x: -0.205, width: 0.086, height: 0.13, depth: 0.07 };
  public static readonly SLOTS = { first: -0.085, last: 0.155, capacity: 5 };
  public static readonly LOAD = { x: 0.235, radius: 0.018 };

  /**
   * Posición horizontal del breaker de una etapa: las etapas se reparten entre el primer y el último hueco.
   *
   * @param index Índice de la etapa.
   * @param count Cantidad de etapas.
   * @returns Coordenada x.
   */
  public stageX(index: number, count: number): number {
    const { first, last } = PanelLayout.SLOTS;
    return count <= 1 ? (first + last) / 2 : first + ((last - first) * index) / (count - 1);
  }

  /**
   * Nodos del recorrido de la corriente por el bus: el MAIN, cada etapa y la carga final.
   *
   * @param count Cantidad de etapas.
   * @returns Coordenada x de cada nodo, en orden.
   */
  public path(count: number): number[] {
    const stages = Array.from({ length: count }, (_, index) => this.stageX(index, count));
    return [PanelLayout.MAIN.x, ...stages, PanelLayout.LOAD.x];
  }

  /**
   * Profundidad de la cara del fondo donde va el dibujo del circuito.
   *
   * @returns Coordenada z.
   */
  public plateZ(): number {
    const { depth, wall } = PanelLayout.CABINET;
    return -depth / 2 + wall + PanelLayout.PLATE.lift;
  }
}
