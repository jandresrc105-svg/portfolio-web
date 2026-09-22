/**
 * Enlace externo mostrado en una sección.
 */
export interface SectionLink {
  /** Texto visible. */
  readonly label: string;
  /** URL destino (`https:` o `mailto:`). */
  readonly href: string;
}
