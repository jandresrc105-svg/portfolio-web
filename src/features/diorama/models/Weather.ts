/**
 * Clima y ambiente del diorama. Cada bandera enciende o apaga un grupo de piezas, para poder tener más
 * adelante varios climas (lluvia, despejado, día/noche) sin tocar la escena.
 */
export interface Weather {
  /** Lluvia: gotas, salpicaduras en el suelo, goteras del techo y su sonido. */
  readonly rain: boolean;
  /** Tormenta eléctrica con relámpagos y truenos (requiere `backdrop`). */
  readonly storm: boolean;
  /** Fondo: cielo con nubes, edificios, luces desenfocadas y rocas flotantes alrededor de la isla. */
  readonly backdrop: boolean;
  /** Niebla que difumina lo lejano. */
  readonly fog: boolean;
}
