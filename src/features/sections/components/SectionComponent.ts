import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { Section } from '../models/Section';
import type { SectionItem } from '../models/SectionItem';
import type { SectionLink } from '../models/SectionLink';

/**
 * Una sección de contenido: tarjeta de vidrio con texto, etiquetas, elementos y enlaces.
 */
export class SectionComponent extends Component {
  /**
   * Crea la sección.
   *
   * @param section Datos de la sección.
   */
  public constructor(private readonly section: Section) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    const { id, align } = this.section;
    return ElementBuilder.create('section')
      .classes('section', `section--${align}`)
      .attr('id', id)
      .attr('aria-labelledby', `${id}-title`)
      .children(this.card())
      .build();
  }

  /**
   * Las secciones solo contienen enlaces nativos; no requieren eventos propios.
   */
  protected override bindEvents(): void {}

  /**
   * Tarjeta con todo el contenido de la sección.
   *
   * @returns Elemento de la tarjeta.
   */
  private card(): HTMLElement {
    const { id, eyebrow, title, paragraphs, tags = [], items = [], links = [] } = this.section;
    return ElementBuilder.create('article')
      .classes('section__card')
      .children(
        ElementBuilder.create('p').classes('section__eyebrow').text(eyebrow).build(),
        ElementBuilder.create('h2').classes('section__title').attr('id', `${id}-title`).text(title).build(),
        ...paragraphs.map((text) => ElementBuilder.create('p').classes('section__text').text(text).build()),
        ...SectionComponent.tagList(tags),
        ...SectionComponent.itemList(items),
        ...SectionComponent.linkList(links),
      )
      .build();
  }

  /**
   * Lista de etiquetas.
   *
   * @param tags Etiquetas.
   * @returns Lista, o vacío si no hay etiquetas.
   */
  private static tagList(tags: readonly string[]): HTMLElement[] {
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
   * Lista de elementos (proyectos, cargos, habilidades).
   *
   * @param items Elementos.
   * @returns Contenedor, o vacío si no hay elementos.
   */
  private static itemList(items: readonly SectionItem[]): HTMLElement[] {
    if (items.length === 0) {
      return [];
    }
    const cards = items.map((item) => SectionComponent.item(item));
    return [
      ElementBuilder.create('div')
        .classes('section__items')
        .children(...cards)
        .build(),
    ];
  }

  /**
   * Tarjeta de un elemento.
   *
   * @param item Elemento.
   * @returns Elemento del DOM.
   */
  private static item(item: SectionItem): HTMLElement {
    const meta = item.meta ? [ElementBuilder.create('p').classes('item__meta').text(item.meta).build()] : [];
    const link = item.link ? [SectionComponent.anchor(item.link, 'item__link')] : [];
    return ElementBuilder.create('article')
      .classes('item')
      .children(
        ...meta,
        ElementBuilder.create('h3').classes('item__title').text(item.title).build(),
        ElementBuilder.create('p').classes('item__text').text(item.description).build(),
        ...SectionComponent.tagList(item.tags ?? []),
        ...link,
      )
      .build();
  }

  /**
   * Barra de enlaces de la sección.
   *
   * @param links Enlaces.
   * @returns Barra, o vacío si no hay enlaces.
   */
  private static linkList(links: readonly SectionLink[]): HTMLElement[] {
    if (links.length === 0) {
      return [];
    }
    const anchors = links.map((link) => SectionComponent.anchor(link, 'section__link'));
    return [
      ElementBuilder.create('nav')
        .classes('section__links')
        .children(...anchors)
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
  private static anchor(link: SectionLink, className: string): HTMLAnchorElement {
    return ElementBuilder.create('a')
      .classes(className)
      .attr('href', link.href)
      .attr('target', '_blank')
      .attr('rel', 'noopener noreferrer')
      .text(link.label)
      .build();
  }
}
