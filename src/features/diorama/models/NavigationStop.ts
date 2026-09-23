/**
 * Parada del recorrido: una sección de la página a la que se puede saltar.
 */
export interface NavigationStop {
  /** Id de la sección HTML destino. */
  readonly sectionId: string;
  /** Nombre visible de la sección. */
  readonly label: string;
}
