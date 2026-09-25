import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { SectionItem } from '../models/SectionItem';
import type { SectionLink } from '../models/SectionLink';

/**
 * Constructor de piezas de tarjeta reutilizadas por las secciones y la vitrina
 * (patrón Builder sobre {@link ElementBuilder}): tarjeta de elemento, lista de etiquetas y enlace seguro.
 */
export class ItemCard {
  /**
   * Prepara la tarjeta de un elemento.
   *
   * @param item Elemento (proyecto, cargo o grupo de habilidades).
   */
  public constructor(private readonly item: SectionItem) {}

  /**
   * Lista de etiquetas.
   *
   * @param tags Etiquetas.
   * @returns Lista, o vacío si no hay etiquetas.
   */
  public static tags(tags: readonly string[]): HTMLElement[] {
    if (tags.length === 0) {
      return [];
    }
    const chips = tags.map((tag) => ElementBuilder.create('li').classes('tag').text(tag).build());
    return [
      ElementBuilder.create('ul')
        .classes('section__tags')
        .children(...chips)
        .build(),
    ];
  }

  /**
   * Enlace externo seguro (nueva pestaña sin acceso a `window.opener`).
   *
   * @param link Enlace.
   * @param className Clase CSS.
   * @returns Elemento `<a>`.
   */
  public static anchor(link: SectionLink, className: string): HTMLAnchorElement {
    return ElementBuilder.create('a')
      .classes(className)
      .attr('href', link.href)
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .text(link.label)
      .build();
  }

  /**
   * Construye la tarjeta.
   *
   * @returns Elemento del DOM.
   */
  public build(): HTMLElement {
    const { item } = this;
    const meta = item.meta ? [ElementBuilder.create('p').classes('item__meta').text(item.meta).build()] : [];
    const link = item.link ? [ItemCard.anchor(item.link, 'item__link')] : [];
    return ElementBuilder.create('article')
      .classes('item')
      .children(
        ...meta,
        ElementBuilder.create('h3').classes('item__title').text(item.title).build(),
        ElementBuilder.create('p').classes('item__text').text(item.description).build(),
        ...ItemCard.tags(item.tags ?? []),
        ...link,
      )
      .build();
  }
}
