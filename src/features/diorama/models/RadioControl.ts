/**
 * Controles de la estación de radio del taller (ids de `WorkshopControl`).
 */
export enum RadioControl {
  /** Perilla y dial de sintonía (se arrastra). */
  Dial = 'dial',
  /** Antena telescópica (se arrastra). */
  Antenna = 'antenna',
  /** Tecla de modo AM / CW. */
  Mode = 'mode',
  /** Botón de encendido. */
  Power = 'power',
  /** Pantalla del espectro: busca la siguiente emisora. */
  Screen = 'screen',
  /** Placa de RF (solo informa). */
  Board = 'board',
  /** Parlante: activa o quita el squelch. */
  Speaker = 'speaker',
}
