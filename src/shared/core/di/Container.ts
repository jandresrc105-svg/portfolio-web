import type { Factory } from './Factory';
import { Lifetime } from './Lifetime';
import type { Provider } from './Provider';
import type { ServiceKey } from './ServiceKey';

/**
 * Contenedor de inyección de dependencias (Service Locator solo en la raíz de composición).
 * Las clases reciben sus dependencias por constructor; únicamente los módulos conocen el contenedor.
 */
export class Container {
  private readonly providers = new Map<ServiceKey<unknown>, Provider<unknown>>();
  private readonly instances = new Map<ServiceKey<unknown>, unknown>();

  /**
   * Registra una dependencia con una única instancia compartida.
   *
   * @param key Clase que identifica la dependencia.
   * @param factory Función que construye la instancia.
   * @returns El propio contenedor, para encadenar registros.
   */
  public singleton<T>(key: ServiceKey<T>, factory: Factory<T>): this {
    return this.register(key, factory, Lifetime.Singleton);
  }

  /**
   * Registra una dependencia que se construye de nuevo en cada resolución.
   *
   * @param key Clase que identifica la dependencia.
   * @param factory Función que construye la instancia.
   * @returns El propio contenedor, para encadenar registros.
   */
  public transient<T>(key: ServiceKey<T>, factory: Factory<T>): this {
    return this.register(key, factory, Lifetime.Transient);
  }

  /**
   * Obtiene una instancia de la dependencia registrada.
   *
   * @param key Clase que identifica la dependencia.
   * @returns Instancia de la dependencia.
   * @throws {Error} Si la dependencia no fue registrada.
   */
  public resolve<T>(key: ServiceKey<T>): T {
    const provider = this.providers.get(key) as Provider<T> | undefined;
    if (!provider) {
      throw new Error(`No hay un proveedor registrado para ${key.name}`);
    }
    if (provider.lifetime === Lifetime.Transient) {
      return provider.factory(this);
    }
    return this.shared(key, provider);
  }

  /**
   * Devuelve la instancia compartida, creándola la primera vez.
   *
   * @param key Clase que identifica la dependencia.
   * @param provider Proveedor registrado.
   * @returns Instancia compartida.
   */
  private shared<T>(key: ServiceKey<T>, provider: Provider<T>): T {
    if (!this.instances.has(key)) {
      this.instances.set(key, provider.factory(this));
    }
    return this.instances.get(key) as T;
  }

  /**
   * Guarda un proveedor evitando registros duplicados.
   *
   * @param key Clase que identifica la dependencia.
   * @param factory Función que construye la instancia.
   * @param lifetime Ciclo de vida.
   * @returns El propio contenedor.
   * @throws {Error} Si la dependencia ya estaba registrada.
   */
  private register<T>(key: ServiceKey<T>, factory: Factory<T>, lifetime: Lifetime): this {
    if (this.providers.has(key)) {
      throw new Error(`${key.name} ya está registrado en el contenedor`);
    }
    this.providers.set(key, { factory, lifetime });
    return this;
  }
}
