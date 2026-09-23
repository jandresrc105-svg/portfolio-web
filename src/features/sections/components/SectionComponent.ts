import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { PidLoopService } from '@shared/control/PidLoopService';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import type { Section } from '../models/Section';
import type { SectionItem } from '../models/SectionItem';
import type { SectionLink } from '../models/SectionLink';
import { ItemCard } from './ItemCard';
import { PidTunerComponent } from './PidTunerComponent';
import { ShowcaseComponent } from './ShowcaseComponent';

/**
 * Una sección de contenido: tarjeta de vidrio con botón para volver a la vista general, texto, etiquetas,
 * elementos y enlaces.
 * Si la sección es una vitrina, sus elementos se recorren de uno en uno con {@link ShowcaseComponent}; si
 * tiene sintonizador, muestra {@link PidTunerComponent} antes de sus elementos. Si es la del teléfono, sus
 * enlaces son el marcado rápido: se numeran y se publican en `contactChannels` para la escena.
 */
export class SectionComponent extends Component {
  private readonly showcase = ElementBuilder.create('div').classes('section__showcase').build();
  private readonly tuner = ElementBuilder.create('div').classes('section__tuner').build();
  private readonly back = ElementBuilder.create('button')
    .classes('section__back')
    .attr('type', 'button')
    .attr('aria-label', 'Volver a la vista general')
    .text('← Volver')
    .build();

  /**
   * Crea la sección.
   *
   * @param section Datos de la sección.
   * @param events Bus de eventos de la aplicación (la vitrina avisa qué elemento se eligió).
   * @param loop Lazo PID del osciloscopio (para el sintonizador).
   * @param onBack Se llama al pulsar "Volver".
   */
  public constructor(
    private readonly section: Section,
    private readonly events: AppEventBus,
    private readonly loop: PidLoopService,
    private readonly onBack: () => void,
  ) {
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
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.listen(this.back, 'click', () => {
      this.onBack();
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    const { showcase, tuner, phone, items = [], links = [] } = this.section;
    if (showcase && items.length > 0) {
      this.mountChild(new ShowcaseComponent(items, this.events), this.showcase);
    }
    if (tuner) {
      this.mountChild(new PidTunerComponent(this.loop), this.tuner);
    }
    if (phone) {
      this.events.emit('contactChannels', links);
    }
  }

  /**
   * Tarjeta con todo el contenido de la sección.
   *
   * @returns Elemento de la tarjeta.
   */
  private card(): HTMLElement {
    const { tags = [], items = [], links = [], showcase, tuner, phone } = this.section;
    const body = showcase ? [this.showcase] : SectionComponent.itemList(items);
    const extras = tuner ? [this.tuner] : [];
    return ElementBuilder.create('article')
      .classes('section__card')
      .children(
        this.back,
        ...this.heading(),
        ...ItemCard.tags(tags),
        ...extras,
        ...body,
        ...SectionComponent.linkList(phone ? SectionComponent.speedDial(links) : links),
      )
      .build();
  }

  /**
   * Antetítulo, título y párrafos de la sección.
   *
   * @returns Elementos del encabezado.
   */
  private heading(): HTMLElement[] {
    const { id, eyebrow, title, paragraphs } = this.section;
    return [
      ElementBuilder.create('p').classes('section__eyebrow').text(eyebrow).build(),
      ElementBuilder.create('h2').classes('section__title').attr('id', `${id}-title`).text(title).build(),
      ...paragraphs.map((text) => ElementBuilder.create('p').classes('section__text').text(text).build()),
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
    const cards = items.map((item) => new ItemCard(item).build());
    return [
      ElementBuilder.create('div')
        .classes('section__items')
        .children(...cards)
        .build(),
    ];
  }

  /**
   * Antepone a cada enlace su tecla de marcado rápido ("1 · GitHub").
   *
   * @param links Enlaces en el orden del marcado rápido.
   * @returns Enlaces con la tecla en el texto.
   */
  private static speedDial(links: readonly SectionLink[]): SectionLink[] {
    return links.map((link, index) => ({ ...link, label: `${String(index + 1)} · ${link.label}` }));
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
    const anchors = links.map((link) => ItemCard.anchor(link, 'section__link'));
    return [
      ElementBuilder.create('nav')
        .classes('section__links')
        .children(...anchors)
        .build(),
    ];
  }
}
