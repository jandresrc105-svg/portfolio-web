import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import type { SectionItem } from '../models/SectionItem';
import { ItemCard } from './ItemCard';

/**
 * Vitrina: muestra un elemento a la vez (hoy, las tecnologías), con flechas, contador y puntos. Cada cambio publica
 * `showcaseSelected` para que la escena 3D resalte la lata correspondiente y la cámara se acerque a ella;
 * al hacer clic en una lata de la escena llega `showcasePicked` y la vitrina muestra ese elemento.
 * Mientras la vitrina está en pantalla, las flechas ← → del teclado solo cambian de elemento: en los
 * extremos no pasan a otra sección, la flecha correspondiente rebota para indicar el tope.
 */
export class ShowcaseComponent extends Component {
  private static readonly KEYS = { previous: 'ArrowLeft', next: 'ArrowRight' };
  private static readonly ACTIVE_DOT = 'showcase__dot--active';
  private static readonly ENTER_CLASS = 'showcase__slide--enter';
  private static readonly BUMP_CLASS = 'showcase__arrow--bump';
  private static readonly ACTIVE_SECTION = '.section--visible';
  private static readonly COUNTER_DIGITS = 2;

  private readonly slide = ElementBuilder.create('div')
    .classes('showcase__slide')
    .attr('aria-live', 'polite')
    .build();
  private readonly counter = ElementBuilder.create('span').classes('showcase__counter').build();
  private readonly previous = ShowcaseComponent.arrow('‹', 'Anterior');
  private readonly next = ShowcaseComponent.arrow('›', 'Siguiente');
  private readonly dots: HTMLButtonElement[];
  private index = 0;
  private unsubscribe: (() => void) | null = null;

  /**
   * Crea la vitrina.
   *
   * @param items Elementos, en el mismo orden que las latas de la máquina.
   * @param events Bus de eventos de la aplicación.
   */
  public constructor(
    private readonly items: readonly SectionItem[],
    private readonly events: AppEventBus,
  ) {
    super();
    this.dots = items.map((item, position) =>
      ElementBuilder.create('button')
        .classes('showcase__dot')
        .attr('type', 'button')
        .attr('aria-label', `Ver ${item.title} (${String(position + 1)})`)
        .build(),
    );
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
    const controls = ElementBuilder.create('div')
      .classes('showcase__controls')
      .children(this.previous, this.counter, this.next)
      .build();
    const dots = ElementBuilder.create('div')
      .classes('showcase__dots')
      .children(...this.dots)
      .build();
    return ElementBuilder.create('div')
      .classes('showcase')
      .attr('role', 'group')
      .attr('aria-label', 'Vitrina de la máquina expendedora')
      .children(controls, this.slide, dots)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.listen(this.previous, 'click', () => {
      this.show(this.index - 1);
    });
    this.listen(this.next, 'click', () => {
      this.show(this.index + 1);
    });
    this.dots.forEach((dot, position) => {
      this.listen(dot, 'click', () => {
        this.show(position);
      });
    });
    this.listen(document.body, 'keydown', (event) => {
      this.onKey(event);
    });
    this.bindBumpReset();
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.unsubscribe = this.events.on('showcasePicked', (item) => {
      this.show(item);
    });
    this.events.emit(
      'showcaseCans',
      this.items.map((item) => item.can ?? ''),
    );
    this.show(0);
  }

  /**
   * Muestra un elemento y avisa a la escena. Fuera de rango no hace nada.
   *
   * @param index Índice deseado.
   */
  private show(index: number): void {
    const item = this.items[index];
    if (!item) {
      return;
    }
    this.index = index;
    this.slide.classList.remove(ShowcaseComponent.ENTER_CLASS);
    this.slide.replaceChildren(new ItemCard(item).build());
    requestAnimationFrame(() => {
      this.slide.classList.add(ShowcaseComponent.ENTER_CLASS);
    });
    this.updateControls();
    this.events.emit('showcaseSelected', this.index);
  }

  /**
   * Refleja el elemento actual en el contador, los puntos y las flechas (desactivadas en los extremos).
   */
  private updateControls(): void {
    const count = this.items.length;
    this.previous.disabled = this.index === 0;
    this.next.disabled = this.index === count - 1;
    this.counter.textContent = `${ShowcaseComponent.pad(this.index + 1)} / ${ShowcaseComponent.pad(count)}`;
    this.dots.forEach((dot, position) => {
      dot.classList.toggle(ShowcaseComponent.ACTIVE_DOT, position === this.index);
      dot.toggleAttribute('aria-current', position === this.index);
    });
  }

  /**
   * Cambia de elemento con las flechas mientras la vitrina está en pantalla. La tecla se consume siempre,
   * así el riel no cambia de sección; en un extremo la flecha rebota.
   *
   * @param event Evento de teclado.
   */
  private onKey(event: KeyboardEvent): void {
    const step = ShowcaseComponent.stepFor(event);
    if (step === 0 || !this.inView()) {
      return;
    }
    event.preventDefault();
    const target = this.index + step;
    if (target >= 0 && target < this.items.length) {
      this.show(target);
    } else {
      this.bump(step > 0 ? this.next : this.previous);
    }
  }

  /**
   * Quita el rebote de las flechas al terminar su animación, para poder repetirlo.
   */
  private bindBumpReset(): void {
    [this.previous, this.next].forEach((arrow) => {
      this.listen(arrow, 'animationend', () => {
        arrow.classList.remove(ShowcaseComponent.BUMP_CLASS);
      });
    });
  }

  /**
   * Hace rebotar una flecha para indicar que no hay más elementos en esa dirección.
   *
   * @param arrow Flecha del extremo.
   */
  private bump(arrow: HTMLButtonElement): void {
    arrow.classList.remove(ShowcaseComponent.BUMP_CLASS);
    requestAnimationFrame(() => {
      arrow.classList.add(ShowcaseComponent.BUMP_CLASS);
    });
  }

  /**
   * Indica si la vitrina está a la vista (su sección es la activa).
   *
   * @returns `true` si está a la vista.
   */
  private inView(): boolean {
    return this.element.closest(ShowcaseComponent.ACTIVE_SECTION) !== null;
  }

  /**
   * Paso que pide una tecla: -1 (anterior), 1 (siguiente) o 0 si no aplica o lleva modificadores.
   *
   * @param event Evento de teclado.
   * @returns Paso.
   */
  private static stepFor(event: KeyboardEvent): number {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return 0;
    }
    const { previous, next } = ShowcaseComponent.KEYS;
    return (event.key === next ? 1 : 0) - (event.key === previous ? 1 : 0);
  }

  /**
   * Botón de flecha.
   *
   * @param symbol Símbolo visible.
   * @param label Texto accesible.
   * @returns Botón.
   */
  private static arrow(symbol: string, label: string): HTMLButtonElement {
    return ElementBuilder.create('button')
      .classes('showcase__arrow')
      .attr('type', 'button')
      .attr('aria-label', label)
      .text(symbol)
      .build();
  }

  /**
   * Número con dos dígitos ("01").
   *
   * @param value Número.
   * @returns Texto con ceros a la izquierda.
   */
  private static pad(value: number): string {
    return String(value).padStart(ShowcaseComponent.COUNTER_DIGITS, '0');
  }
}
