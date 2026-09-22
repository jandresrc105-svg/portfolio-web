/**
 * Perfil profesional que se muestra en la presentación.
 */
export interface Profile {
  /** Nombre completo. */
  readonly name: string;
  /** Cargo o título profesional. */
  readonly role: string;
  /** Frase corta de presentación. */
  readonly headline: string;
  /** Fecha de inicio en desarrollo web, formato ISO `YYYY-MM-DD`. */
  readonly careerStartDate: string;
}
