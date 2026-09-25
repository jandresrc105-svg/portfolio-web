import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import type { NavigationStop } from '../models/NavigationStop';

/**
 * Riel de navegación del recorrido: un punto por sección con su nombre, que marca la sección activa y
 * permite ir a cualquiera. Con el teclado, ← → pasan a la sección anterior o siguiente y Esc vuelve a la
 * vista general.
 */
export class SectionNavComponent extends Component {
  private static readonly HOME: NavigationStop = { sectionId: SectionNavigator.HOME, label: 'Inicio' };
  private static readonly ACTIVE_CLASS = 'section-nav__stop--active';
  private static readonly KEYS = { previous: 'ArrowLeft', next: 'ArrowRight', home: 'Escape' };
  private static readonly HINT = '← → para recorrer · Esc para volver';
  private static readonly EDITABLE_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

  private stops: NavigationStop[] = [SectionNavComponent.HOME];
  private readonly buttons: HTMLButtonElement[] = [];
  private unsubscribe: (() => void) | null = null;

  /**
   * Crea el riel.
   *
   * @param navigator Navegación entre secciones.
   */
  public constructor(private readonly navigator: SectionNavigator) {
    super();
  }

  /**
   * Define las paradas (además del inicio). Debe llamarse antes de montar.
   *
   * @param stops Secciones del recorrido, en orden.
   */
  public setStops(stops: readonly NavigationStop[]): void {
    this.stops = [SectionNavComponent.HOME, ...stops];
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.buttons.splice(0);
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    const items = this.stops.map((stop) => {
      const button = SectionNavComponent.stopButton(stop);
      this.buttons.push(button);
      return ElementBuilder.create('li').children(button).build();
    });
    return ElementBuilder.create('nav')
      .classes('section-nav')
      .attr('aria-label', 'Recorrido del portafolio')
      .children(
        ElementBuilder.create('ol')
          .classes('section-nav__list')
          .children(...items)
          .build(),
        ElementBuilder.create('p').classes('section-nav__hint').text(SectionNavComponent.HINT).build(),
      )
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.buttons.forEach((button, index) => {
      this.listen(button, 'click', () => {
        this.navigator.go(this.stops[index]?.sectionId ?? SectionNavigator.HOME);
      });
    });
    this.listenWindow('keydown', (event) => {
      this.onKey(event);
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.unsubscribe = this.navigator.onChange(() => {
      this.highlight();
    });
    this.highlight();
  }

  /**
   * Cambia de sección con el teclado, salvo que el usuario esté escribiendo.
   *
   * @param event Evento de teclado.
   */
  private onKey(event: KeyboardEvent): void {
    if (SectionNavComponent.ignored(event)) {
      return;
    }
    const { previous, next, home } = SectionNavComponent.KEYS;
    if (event.key === previous) {
      this.navigator.step(-1);
    } else if (event.key === next) {
      this.navigator.step(1);
    } else if (event.key === home) {
      this.navigator.home();
    }
  }

  /**
   * Marca la parada activa.
   */
  private highlight(): void {
    const index = this.navigator.position;
    this.buttons.forEach((button, position) => {
      button.classList.toggle(SectionNavComponent.ACTIVE_CLASS, position === index);
      button.toggleAttribute('aria-current', position === index);
    });
  }

  /**
   * Indica si la tecla no debe mover el recorrido: el usuario escribe o usa un atajo con modificador.
   *
   * @param event Evento de teclado.
   * @returns `true` si se ignora.
   */
  private static ignored(event: KeyboardEvent): boolean {
    if (event.defaultPrevented) {
      return true;
    }
    const target = event.target instanceof Element ? event.target : null;
    const typing = target?.closest(SectionNavComponent.EDITABLE_SELECTOR) ?? null;
    return typing !== null || event.altKey || event.ctrlKey || event.metaKey;
  }

  /**
   * Botón de una parada: nombre y punto.
   *
   * @param stop Parada.
   * @returns Botón.
   */
  private static stopButton(stop: NavigationStop): HTMLButtonElement {
    return ElementBuilder.create('button')
      .classes('section-nav__stop')
      .attr('type', 'button')
      .attr('aria-label', `Ir a ${stop.label}`)
      .children(
        ElementBuilder.create('span').classes('section-nav__label').text(stop.label).build(),
        ElementBuilder.create('span').classes('section-nav__dot').attr('aria-hidden', 'true').build(),
      )
      .build();
  }
}
