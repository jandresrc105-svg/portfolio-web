/**
 * Llave con la que se registra y resuelve una dependencia en el contenedor.
 * Se usa la propia clase (concreta o abstracta) como identificador, lo que permite
 * registrar una implementación concreta bajo una abstracción.
 */
export type ServiceKey<T> = abstract new (...args: never[]) => T;
