/**
 * Configuración de entorno leída de las variables `VITE_*` en tiempo de build.
 */
export class Environment {
  /**
   * URL base del backend. Vacía mientras no exista backend: se usan los datos de `public/`.
   *
   * @returns URL base sin barra final.
   */
  public get apiUrl(): string {
    return (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  }

  /**
   * Indica si la aplicación corre en modo desarrollo.
   *
   * @returns `true` en desarrollo.
   */
  public get isDevelopment(): boolean {
    return import.meta.env.DEV;
  }
}
