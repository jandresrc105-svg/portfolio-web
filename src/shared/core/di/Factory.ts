import type { Container } from './Container';

/**
 * Función que construye una dependencia resolviendo sus propias dependencias desde el contenedor.
 */
export type Factory<T> = (container: Container) => T;
