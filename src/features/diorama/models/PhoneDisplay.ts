/**
 * Texto de la pantalla LCD del teléfono.
 */
export interface PhoneDisplay {
  /** Línea superior, grande (p. ej. "MARQUE"). */
  readonly title: string;
  /** Línea inferior, pequeña (p. ej. "1 · 2 · 3"). */
  readonly detail: string;
}
