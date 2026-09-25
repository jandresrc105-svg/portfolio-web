import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { PidLoopService } from '@shared/control/PidLoopService';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import type { Section } from '../models/Section';
import type { SectionCertificate } from '../models/SectionCertificate';
import type { SectionItem } from '../models/SectionItem';
import type { SectionLink } from '../models/SectionLink';
import type { ShowcaseChannel } from '../models/ShowcaseChannel';
import { ItemCard } from './ItemCard';
import { PidTunerComponent } from './PidTunerComponent';
import { ShowcaseComponent } from './ShowcaseComponent';

/**
 * Una sección de contenido: tarjeta de vidrio con botón para volver a la vista general, texto, etiquetas,
 * elementos y enlaces.
 * Si la sección es una vitrina (latas), los proyectos (placas) o la trayectoria (breakers), sus elementos se
 * recorren de uno en uno
 * con {@link ShowcaseComponent} y se publica a la escena qué objeto corresponde a cada uno; si tiene
 * sintonizador, muestra {@link PidTunerComponent} antes de sus elementos. Si es la del teléfono, sus
 * enlaces son el marcado rápido: se numeran y se publican en `contactChannels` para la escena.
 */
export class SectionComponent extends Component {
  private static readonly SHOWCASE: ShowcaseChannel = {
    selected: 'showcaseSelected',
    picked: 'showcasePicked',
    label: 'Vitrina de la máquina expendedora',
  };
  private static readonly BENCH: ShowcaseChannel = {
    selected: 'benchSelected',
    picked: 'benchPicked',
    label: 'Placas del banco del taller',
  };
  private static readonly TIMELINE: ShowcaseChannel = {
    selected: 'timelineSelected',
    picked: 'timelinePicked',
    label: 'Etapas del tablero del poste',
  };

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
    const { tuner, phone, links = [] } = this.section;
    this.mountShowcase();
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
    const { tags = [], links = [], tuner, phone, certificates = [] } = this.section;
    const extras = tuner ? [this.tuner] : [];
    return ElementBuilder.create('article')
      .classes('section__card')
      .children(
        this.back,
        ...this.heading(),
        ...ItemCard.tags(tags),
        ...extras,
        ...this.body(),
        ...SectionComponent.certificateList(certificates),
        ...SectionComponent.linkList(phone ? SectionComponent.speedDial(links) : links),
      )
      .build();
  }

  /**
   * Cuerpo de la tarjeta: la vitrina (si la sección recorre sus elementos de a uno) o la lista de elementos.
   *
   * @returns Elementos del cuerpo.
   */
  private body(): HTMLElement[] {
    const { items = [] } = this.section;
    return this.channel() === null ? SectionComponent.itemList(items) : [this.showcase];
  }

  /**
   * Eventos de la vitrina de la sección, si recorre sus elementos de a uno: la trayectoria (breakers), los
   * proyectos (placas) o las tecnologías (latas).
   *
   * @returns Canal de la vitrina o `null` si la sección no tiene vitrina.
   */
  private channel(): ShowcaseChannel | null {
    const { showcase, timeline, bench } = this.section;
    if (timeline) {
      return SectionComponent.TIMELINE;
    }
    if (bench) {
      return SectionComponent.BENCH;
    }
    return showcase ? SectionComponent.SHOWCASE : null;
  }

  /**
   * Si la sección tiene vitrina, publica a la escena el objeto de cada elemento (etiqueta de breaker, de
   * placa o sabor de lata) y monta la vitrina con sus eventos.
   */
  private mountShowcase(): void {
    const { items = [] } = this.section;
    const channel = this.channel();
    if (items.length === 0 || channel === null) {
      return;
    }
    this.announce(items);
    this.mountChild(new ShowcaseComponent(items, this.events, channel), this.showcase);
  }

  /**
   * Publica a la escena qué objeto corresponde a cada elemento de la vitrina.
   *
   * @param items Elementos de la sección.
   */
  private announce(items: readonly SectionItem[]): void {
    const { timeline, bench } = this.section;
    if (timeline) {
      this.announceTimeline(items);
    } else if (bench) {
      this.events.emit(
        'benchBoards',
        items.map((item) => item.board ?? item.title),
      );
    } else {
      this.events.emit(
        'showcaseCans',
        items.map((item) => item.can ?? ''),
      );
    }
  }

  /**
   * Publica al tablero del poste la etiqueta de cada etapa, los sellos de las certificaciones y la fecha del
   * medidor.
   *
   * @param items Etapas de la trayectoria.
   */
  private announceTimeline(items: readonly SectionItem[]): void {
    const { certificates = [], since = '' } = this.section;
    const breakers = items.map((item) => item.breaker ?? item.title);
    const seals = certificates.map((certificate) => `${certificate.issuer} ${certificate.year}`);
    this.events.emit('timelineDirectory', { breakers, seals, since });
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
   * Lista de certificaciones ("Fundamentals of Deep Learning — NVIDIA · 2022").
   *
   * @param certificates Certificaciones.
   * @returns Bloque con título y lista, o vacío si no hay certificaciones.
   */
  private static certificateList(certificates: readonly SectionCertificate[]): HTMLElement[] {
    if (certificates.length === 0) {
      return [];
    }
    const rows = certificates.map((certificate) => SectionComponent.certificateRow(certificate));
    const heading = ElementBuilder.create('h3')
      .classes('certificates__heading')
      .text('Certificaciones')
      .build();
    const list = ElementBuilder.create('ul')
      .classes('certificates__list')
      .children(...rows)
      .build();
    return [ElementBuilder.create('div').classes('certificates').children(heading, list).build()];
  }

  /**
   * Una fila de la lista de certificaciones: nombre a la izquierda, emisor y año a la derecha.
   *
   * @param certificate Certificación.
   * @returns Elemento `<li>`.
   */
  private static certificateRow(certificate: SectionCertificate): HTMLElement {
    const { title, issuer, year } = certificate;
    return ElementBuilder.create('li')
      .classes('certificates__item')
      .children(
        ElementBuilder.create('span').classes('certificates__title').text(title).build(),
        ElementBuilder.create('span').classes('certificates__meta').text(`${issuer} · ${year}`).build(),
      )
      .build();
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
