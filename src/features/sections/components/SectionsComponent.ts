import type { PidLoopService } from '@shared/control/PidLoopService';
import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import type { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import type { SectionsService } from '../services/SectionsService';
import { SectionComponent } from './SectionComponent';

/**
 * Paneles de contenido sobre la escena. Solo se muestra el de la sección activa del
 * {@link SectionNavigator}; los demás quedan ocultos e inertes.
 */
export class SectionsComponent extends Component {
  private static readonly VISIBLE_CLASS = 'section--visible';
  private static readonly ERROR_TEXT = 'No fue posible cargar el contenido. Intenta recargar la página.';

  private unsubscribe: (() => void) | null = null;

  /**
   * Crea la lista.
   *
   * @param sections Service de secciones.
   * @param events Bus de eventos de la aplicación.
   * @param navigator Navegación entre secciones.
   * @param loop Lazo PID del osciloscopio (para el sintonizador de su sección).
   */
  public constructor(
    private readonly sections: SectionsService,
    private readonly events: AppEventBus,
    private readonly navigator: SectionNavigator,
    private readonly loop: PidLoopService,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    return ElementBuilder.create('div').classes('sections').build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.unsubscribe = this.navigator.onChange(() => {
      this.refresh();
    });
  }

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
        const child = new SectionComponent(section, this.events, this.loop, () => {
          this.navigator.home();
        });
        this.mountChild(child);
      });
      this.refresh();
    } catch (error: unknown) {
      console.error(error);
      this.element.append(
        ElementBuilder.create('p').classes('sections__error').text(SectionsComponent.ERROR_TEXT).build(),
      );
    }
  }

  /**
   * Muestra el panel de la sección activa y deja inertes los demás.
   */
  private refresh(): void {
    const current = this.navigator.current;
    this.element.querySelectorAll('.section').forEach((section) => {
      const visible = section.id === current;
      section.classList.toggle(SectionsComponent.VISIBLE_CLASS, visible);
      section.toggleAttribute('inert', !visible);
    });
  }
}
