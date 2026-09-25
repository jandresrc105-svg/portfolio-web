/**
 * Modo de demodulación del receptor de radio del taller.
 */
export enum RadioMode {
  /** Amplitud modulada: el detector de envolvente entrega la música de la emisora. */
  Am = 'AM',
  /** Onda continua (telegrafía): el BFO bate con la portadora y la vuelve un tono audible. */
  Cw = 'CW',
}
