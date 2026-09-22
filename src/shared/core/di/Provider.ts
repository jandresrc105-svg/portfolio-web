import type { Factory } from './Factory';
import type { Lifetime } from './Lifetime';

/**
 * Registro interno del contenedor: cómo construir una dependencia y cuánto vive.
 */
export interface Provider<T> {
  /** Función que construye la instancia. */
  readonly factory: Factory<T>;
  /** Ciclo de vida de la instancia. */
  readonly lifetime: Lifetime;
}
