import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import type { SmoothScroll } from '@shared/core/scroll/SmoothScroll';
import type { DioramaExperience } from '../experience/DioramaExperience';
import type { DioramaExperienceFactory } from '../experience/DioramaExperienceFactory';
import type { BootScreenComponent } from './BootScreenComponent';
import type { SoundToggleComponent } from './SoundToggleComponent';

/**
 * Fondo 3D del portafolio. Maneja el canvas, el tooltip de los marcadores y los eventos del usuario;
 * toda la lógica 3D vive en {@link DioramaExperience}.
 */
export class DioramaComponent extends Component {
  private static readonly TOOLTIP_OFFSET = 18;
  private static readonly INTERACTIVE_SELECTOR = 'a, button, input, textarea, .section__card';

  private readonly canvas = ElementBuilder.create('canvas')
    .classes('diorama__canvas')
    .attr('aria-hidden', 'true')
    .build();
  private readonly tooltip = ElementBuilder.create('div')
    .classes('diorama__tooltip')
    .attr('aria-hidden', 'true')
    .build();
  private readonly hint = ElementBuilder.create('p')
    .classes('diorama__hint')
    .text('Desliza para recorrer el puesto · toca los marcadores')
    .build();
  private experience: DioramaExperience | null = null;
  private unsubscribe: (() => void) | null = null;

  /**
   * Crea el componente.
   *
   * @param factory Fábrica de la experiencia 3D.
   * @param scroll Scroll suave compartido.
   * @param events Bus de eventos de la aplicación.
   * @param boot Pantalla de arranque.
   * @param soundToggle Botón de sonido.
   */
  public constructor(
    private readonly factory: DioramaExperienceFactory,
    private readonly scroll: SmoothScroll,
    private readonly events: AppEventBus,
    private readonly boot: BootScreenComponent,
    private readonly soundToggle: SoundToggleComponent,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.unsubscribe?.();
    this.experience?.dispose();
    this.experience = null;
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    return ElementBuilder.create('div')
      .classes('diorama')
      .children(this.canvas, this.tooltip, this.hint)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.listenWindow('resize', () => {
      this.experience?.resize(window.innerWidth, window.innerHeight);
    });
    this.listenWindow('pointermove', (event) => {
      this.track(event);
    });
    this.listenWindow('click', (event) => {
      this.select(event);
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.mountChild(this.boot, document.body);
    void this.start();
  }

  /**
   * Arranca la experiencia: sonido, consola de arranque mientras compila la escena, y la intro.
   */
  private async start(): Promise<void> {
    this.scroll.start();
    this.scroll.lock();
    this.factory.startSound();
    try {
      const experience = this.createExperience();
      await this.boot.play(this.prepare(experience));
      await this.boot.dismiss();
      this.unsubscribe = this.scroll.onProgress((progress) => {
        experience.setScroll(progress);
      });
      await experience.powerOn(this.factory.prefersReducedMotion());
    } catch (error: unknown) {
      console.error(error);
      this.element.classList.add('diorama--fallback');
      await this.boot.dismiss();
    }
    this.finish();
  }

  /**
   * Crea la experiencia si el dispositivo la soporta.
   *
   * @returns Experiencia 3D.
   * @throws {Error} Si no hay soporte para WebGL2.
   */
  private createExperience(): DioramaExperience {
    if (!this.factory.isSupported()) {
      throw new Error('WebGL2 no disponible: se muestra la versión sin 3D');
    }
    this.experience = this.factory.create(this.canvas);
    return this.experience;
  }

  /**
   * Carga fuentes y prepara la escena.
   *
   * @param experience Experiencia a preparar.
   */
  private async prepare(experience: DioramaExperience): Promise<void> {
    await this.factory.loadFonts();
    await experience.prepare(window.innerWidth, window.innerHeight);
  }

  /**
   * Libera el scroll, muestra el botón de sonido y avisa al resto de la app que la intro terminó.
   */
  private finish(): void {
    this.scroll.unlock();
    this.element.classList.add('diorama--ready');
    this.mountChild(this.soundToggle, document.body);
    this.events.emit('introComplete', undefined);
  }

  /**
   * Actualiza puntero, paralaje y tooltip.
   *
   * @param event Evento de puntero.
   */
  private track(event: PointerEvent | MouseEvent): void {
    if (!this.experience) {
      return;
    }
    this.experience.setPointer(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
    );
    const hotspot = this.experience.hover();
    this.tooltip.textContent = hotspot?.label ?? '';
    this.tooltip.classList.toggle('diorama__tooltip--visible', hotspot !== null);
    this.tooltip.style.transform = `translate(${String(event.clientX + DioramaComponent.TOOLTIP_OFFSET)}px, ${String(event.clientY)}px)`;
    document.body.classList.toggle('is-pointing', hotspot !== null);
  }

  /**
   * Si el clic cae sobre un marcador (y no sobre contenido), navega a su sección.
   *
   * @param event Evento de clic.
   */
  private select(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(DioramaComponent.INTERACTIVE_SELECTOR)) {
      return;
    }
    this.track(event);
    const hotspot = this.experience?.hover();
    if (hotspot) {
      this.experience?.select();
      this.scroll.scrollTo(hotspot.sectionId);
    }
  }
}
