/**
 * Clase base de todos los componentes (patrón Template Method + Composite).
 *
 * Cada componente separa dos responsabilidades:
 * - DOM: {@link Component.render} construye y devuelve su elemento raíz.
 * - Eventos: {@link Component.bindEvents} registra listeners con {@link Component.listen},
 *   que se liberan automáticamente al desmontar.
 *
 * Ciclo de vida: `render` → `bindEvents` → `onMount` (opcional) → … → `unmount`.
 *
 * La lógica de negocio no vive aquí: se delega a services inyectados por constructor.
 */
export abstract class Component<TElement extends HTMLElement = HTMLElement> {
  private host: TElement | null = null;
  private listeners = new AbortController();
  private readonly children: Component[] = [];

  /**
   * Elemento raíz del componente montado.
   *
   * @returns Elemento raíz.
   * @throws {Error} Si se accede antes de montar el componente.
   */
  protected get element(): TElement {
    if (!this.host) {
      throw new Error(`${this.constructor.name} no está montado`);
    }
    return this.host;
  }

  /**
   * Indica si el componente está en el DOM.
   *
   * @returns `true` si está montado.
   */
  public get isMounted(): boolean {
    return this.host !== null;
  }

  /**
   * Construye el componente, lo inserta en el padre y activa sus eventos.
   *
   * @param parent Elemento donde se inserta el componente.
   * @returns Elemento raíz del componente.
   */
  public mount(parent: HTMLElement): TElement {
    this.listeners = new AbortController();
    this.host = this.render();
    parent.append(this.host);
    this.bindEvents();
    this.onMount?.();
    return this.host;
  }

  /**
   * Libera eventos, desmonta los hijos y retira el elemento del DOM.
   */
  public unmount(): void {
    this.listeners.abort();
    this.children.splice(0).forEach((child) => {
      child.unmount();
    });
    this.host?.remove();
    this.host = null;
  }

  /**
   * Construye el árbol DOM del componente.
   *
   * @returns Elemento raíz del componente.
   */
  protected abstract render(): TElement;

  /**
   * Registra los eventos del componente. Se ejecuta después de {@link Component.render}.
   */
  protected abstract bindEvents(): void;

  /**
   * Hook opcional que se ejecuta cuando el componente ya está en el DOM (carga de datos, hijos, animaciones).
   */
  protected onMount?(): void;

  /**
   * Registra un listener que se elimina automáticamente al desmontar el componente.
   *
   * @param target Elemento que emite el evento.
   * @param type Tipo de evento.
   * @param handler Manejador del evento.
   * @param capture Escuchar en la fase de captura (antes que los listeners de los hijos).
   */
  protected listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    capture = false,
  ): void {
    target.addEventListener(type, handler, { signal: this.listeners.signal, capture });
  }

  /**
   * Registra un listener sobre `window` que se elimina automáticamente al desmontar el componente.
   *
   * @param type Tipo de evento.
   * @param handler Manejador del evento.
   */
  protected listenWindow<K extends keyof WindowEventMap>(
    type: K,
    handler: (event: WindowEventMap[K]) => void,
  ): void {
    window.addEventListener(type, handler, { signal: this.listeners.signal, passive: true });
  }

  /**
   * Monta un componente hijo y lo asocia al ciclo de vida de este.
   *
   * @param child Componente hijo.
   * @param parent Elemento donde se inserta; por defecto la raíz de este componente.
   */
  protected mountChild(child: Component, parent: HTMLElement = this.element): void {
    child.mount(parent);
    this.children.push(child);
  }
}
