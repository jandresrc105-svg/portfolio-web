/**
 * Catálogo de eventos de la aplicación y el tipo de su carga.
 */
export interface AppEvents {
  /** La secuencia de encendido terminó: la escena y el contenido ya son interactivos. */
  readonly introComplete: undefined;
  /** El visitante eligió un elemento de la vitrina (índice desde 0). */
  readonly showcaseSelected: number;
  /** La vitrina se montó: sabor de la lata (tecnología) de cada uno de sus elementos, en orden. */
  readonly showcaseCans: readonly string[];
  /** El visitante hizo clic sobre una lata de la vitrina en la escena 3D (índice desde 0). */
  readonly showcasePicked: number;
}
