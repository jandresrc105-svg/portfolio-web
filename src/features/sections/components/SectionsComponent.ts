import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { SectionsService } from '../services/SectionsService';
import { SectionComponent } from './SectionComponent';

/**
 * Lista de secciones de contenido. Cada sección aparece con una transición al entrar en pantalla.
 */
export class SectionsComponent extends Component {
  private static readonly VISIBLE_CLASS = 'section--visible';
  private static readonly REVEAL_THRESHOLD = 0.35;
  private static readonly ERROR_TEXT = 'No fue posible cargar el contenido. Intenta recargar la página.';

  private readonly observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle(SectionsComponent.VISIBLE_CLASS, entry.isIntersecting);
      });
    },
    { threshold: SectionsComponent.REVEAL_THRESHOLD },
  );

  /**
   * Crea la lista.
   *
   * @param sections Service de secciones.
   */
  public constructor(private readonly sections: SectionsService) {
    super();
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.observer.disconnect();
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    return ElementBuilder.create('div').classes('sections').build();
  }

  /**
   * Las secciones no tienen eventos propios; la aparición la maneja un IntersectionObserver.
   */
  protected override bindEvents(): void {}

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    void this.load();
  }

  /**
   * Carga las secciones y las monta.
   */
  private async load(): Promise<void> {
    try {
      const sections = await this.sections.getSections();
      sections.forEach((section) => {
        const child = new SectionComponent(section);
        this.mountChild(child);
      });
      this.element.querySelectorAll('.section').forEach((element) => {
        this.observer.observe(element);
      });
    } catch (error: unknown) {
      console.error(error);
      this.element.append(
        ElementBuilder.create('p').classes('sections__error').text(SectionsComponent.ERROR_TEXT).build(),
      );
    }
  }
}
