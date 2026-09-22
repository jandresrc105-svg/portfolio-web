import type { Container } from './Container';

/**
 * Módulo que registra en el contenedor las dependencias de una feature (api, services y componentes).
 */
export interface FeatureModule {
  /**
   * Registra los proveedores del módulo.
   *
   * @param container Contenedor de dependencias de la aplicación.
   */
  register(container: Container): void;
}
