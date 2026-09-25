/**
 * Constructor fluido de elementos del DOM (patrón Builder).
 * Evita `innerHTML`, por lo que el contenido de texto nunca se interpreta como HTML.
 *
 * @example
 * ElementBuilder.create('h1').classes('hero__title').text('Hola').build();
 */
export class ElementBuilder<K extends keyof HTMLElementTagNameMap> {
  private readonly node: HTMLElementTagNameMap[K];

  /**
   * Crea el elemento. Usa {@link ElementBuilder.create} en lugar del constructor.
   *
   * @param tag Etiqueta HTML del elemento a construir.
   */
  private constructor(tag: K) {
    this.node = document.createElement(tag);
  }

  /**
   * Inicia la construcción de un elemento.
   *
   * @param tag Etiqueta HTML.
   * @returns Builder del elemento.
   */
  public static create<T extends keyof HTMLElementTagNameMap>(tag: T): ElementBuilder<T> {
    return new ElementBuilder(tag);
  }

  /**
   * Agrega clases CSS.
   *
   * @param names Nombres de clase.
   * @returns El builder.
   */
  public classes(...names: string[]): this {
    this.node.classList.add(...names);
    return this;
  }

  /**
   * Define el contenido de texto.
   *
   * @param value Texto plano.
   * @returns El builder.
   */
  public text(value: string): this {
    this.node.textContent = value;
    return this;
  }

  /**
   * Define un atributo.
   *
   * @param name Nombre del atributo.
   * @param value Valor del atributo.
   * @returns El builder.
   */
  public attr(name: string, value: string): this {
    this.node.setAttribute(name, value);
    return this;
  }

  /**
   * Agrega nodos hijos.
   *
   * @param nodes Nodos a insertar en orden.
   * @returns El builder.
   */
  public children(...nodes: Node[]): this {
    this.node.append(...nodes);
    return this;
  }

  /**
   * Finaliza la construcción.
   *
   * @returns Elemento construido.
   */
  public build(): HTMLElementTagNameMap[K] {
    return this.node;
  }
}
