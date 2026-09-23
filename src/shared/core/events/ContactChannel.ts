/**
 * Canal de contacto (GitHub, LinkedIn, correo) que se puede "llamar" desde el teléfono de la escena.
 */
export interface ContactChannel {
  /** Nombre visible. */
  readonly label: string;
  /** URL que se abre al conectar la llamada. */
  readonly href: string;
}
