/**
 * Paso de la estación de cableado. Los pasos `Pulling`, `Tinning` y `Connecting` son animaciones que avanzan
 * solas; los demás esperan al visitante.
 */
export enum WireStep {
  /** Carrete listo: falta tirar y cortar un tramo. */
  Spool = 'spool',
  /** Tirando cable del carrete (animación). */
  Pulling = 'pulling',
  /** Tramo cortado: falta pelar la punta. */
  Cut = 'cut',
  /** Punta pelada: falta torcer los hilos. */
  Stripped = 'stripped',
  /** Hilos trenzados: falta estañar. */
  Twisted = 'twisted',
  /** El cautín está estañando la punta (animación). */
  Tinning = 'tinning',
  /** Punta estañada: falta conectarla a la bornera. */
  Tinned = 'tinned',
  /** El cable entra en la bornera y el tornillo aprieta (animación). */
  Connecting = 'connecting',
  /** Conectado: la bornera marca continuidad. */
  Connected = 'connected',
  /** Se pelaron de más y se cortaron hilos: hay que reiniciar. */
  Ruined = 'ruined',
}
