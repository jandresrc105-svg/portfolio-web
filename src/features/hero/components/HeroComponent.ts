import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import type { Profile } from '../models/Profile';
import type { ProfileService } from '../services/ProfileService';

/**
 * Presentación inicial sobre el diorama: nombre, rol y experiencia.
 * Aparece cuando termina la secuencia de encendido y solo mientras se está en la vista general.
 * Solo maneja DOM y eventos; los datos y cálculos vienen de {@link ProfileService}.
 */
export class HeroComponent extends Component {
  private static readonly VISIBLE_CLASS = 'hero--visible';
  private static readonly ERROR_TEXT = 'No fue posible cargar el perfil.';

  private readonly title = ElementBuilder.create('h1')
    .classes('hero__title')
    .attr('id', 'hero-title')
    .build();
  private readonly role = ElementBuilder.create('p').classes('hero__role').build();
  private readonly headline = ElementBuilder.create('p').classes('hero__headline').build();
  private readonly experience = ElementBuilder.create('p').classes('hero__experience').build();
  private readonly subscriptions: (() => void)[] = [];
  private introDone = false;

  /**
   * Crea la presentación.
   *
   * @param profiles Service del perfil.
   * @param events Bus de eventos de la aplicación.
   * @param navigator Navegación entre secciones.
   */
  public constructor(
    private readonly profiles: ProfileService,
    private readonly events: AppEventBus,
    private readonly navigator: SectionNavigator,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.subscriptions.splice(0).forEach((unsubscribe) => {
      unsubscribe();
    });
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    const cue = ElementBuilder.create('p').classes('hero__cue').text('Explora').build();
    const content = ElementBuilder.create('div')
      .classes('hero__content')
      .children(this.role, this.title, this.headline, this.experience)
      .build();
    return ElementBuilder.create('section')
      .classes('hero')
      .attr('id', SectionNavigator.HOME)
      .attr('aria-labelledby', 'hero-title')
      .children(content, cue)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.subscriptions.push(
      this.events.on('introComplete', () => {
        this.introDone = true;
        this.refresh();
      }),
      this.navigator.onChange(() => {
        this.refresh();
      }),
    );
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    void this.load();
  }

  /**
   * Muestra la presentación solo en la vista general y una vez terminada la intro.
   */
  private refresh(): void {
    const visible = this.introDone && this.navigator.current === SectionNavigator.HOME;
    this.element.classList.toggle(HeroComponent.VISIBLE_CLASS, visible);
    this.element.toggleAttribute('inert', !visible);
  }

  /**
   * Carga el perfil y actualiza la vista, mostrando un mensaje si falla.
   */
  private async load(): Promise<void> {
    try {
      this.show(await this.profiles.getProfile());
    } catch (error: unknown) {
      console.error(error);
      this.title.textContent = HeroComponent.ERROR_TEXT;
    }
  }

  /**
   * Pinta los datos del perfil.
   *
   * @param profile Perfil a mostrar.
   */
  private show(profile: Profile): void {
    this.title.textContent = profile.name;
    this.role.textContent = profile.role;
    this.headline.textContent = profile.headline;
    this.experience.textContent = `${this.profiles.experienceLabel(profile)} construyendo para la web`;
  }
}
