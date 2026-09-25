/**
 * Certificación o curso aprobado. En la trayectoria se lista en la tarjeta y aparece como sello de
 * inspección pegado dentro de la puerta del tablero del poste.
 */
export interface SectionCertificate {
  /** Nombre del curso ("Fundamentals of Deep Learning"). */
  readonly title: string;
  /** Quién lo emite ("NVIDIA"); es lo que se lee en el sello. */
  readonly issuer: string;
  /** Año de emisión ("2022"). */
  readonly year: string;
}
