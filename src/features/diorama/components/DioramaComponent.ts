import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import type { AppEventBus } from '@shared/core/events/AppEventBus';
import type { ContactChannel } from '@shared/core/events/ContactChannel';
import type { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import type { DioramaExperience } from '../experience/DioramaExperience';
import type { DioramaExperienceFactory } from '../experience/DioramaExperienceFactory';
import type { DioramaDevices } from '../models/DioramaDevices';
import type { DioramaOverlays } from './DioramaOverlays';

/**
 * Escena 3D a pantalla completa. Maneja el canvas, el tooltip, los clics sobre marcadores, latas, el
 * teléfono, el tablero del poste y el banco del taller (y los números del teclado físico, que marcan en la sección de contacto); el
 * giro, la rueda y los gestos táctiles los atiende la cámara de {@link DioramaExperience}. Cada cambio de
 * sección del {@link SectionNavigator} lleva la cámara a su parada.
 */
export class DioramaComponent extends Component {
  private static readonly TOOLTIP_OFFSET = 18;
  private static readonly INTERACTIVE_SELECTOR = 'a, button, input, textarea, .section__card';
  private static readonly DRAG_THRESHOLD = 6;
  private static readonly DRAGGING_CLASS = 'is-dragging';
  private static readonly TUNING_CLASS = 'is-tuning';
  private static readonly DIAL_KEY = /^[0-9*#]$/;
  private static readonly CALL_FEATURES = 'noopener,noreferrer';
  private static readonly PERF_PARAM = 'perf';

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
    .text('Arrastra para girar · rueda para acercar · toca los marcadores y las latas')
    .build();
  private experience: DioramaExperience | null = null;
  private press: { x: number; y: number } | null = null;
  private grabbedAt: number | null = null;
  private suppressClick = false;
  private item = 0;
  private showcaseCans: readonly string[] = [];
  private contacts: readonly ContactChannel[] = [];
  private readonly subscriptions: (() => void)[] = [];

  /**
   * Crea el componente.
   *
   * @param factory Fábrica de la experiencia 3D.
   * @param navigator Navegación entre secciones.
   * @param events Bus de eventos de la aplicación.
   * @param devices Equipos de la escena (el tablero del poste y el banco del taller hablan con las vitrinas).
   * @param overlays Consola de arranque, botón de sonido y riel de secciones.
   */
  public constructor(
    private readonly factory: DioramaExperienceFactory,
    private readonly navigator: SectionNavigator,
    private readonly events: AppEventBus,
    private readonly devices: DioramaDevices,
    private readonly overlays: DioramaOverlays,
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
    this.bindPointer();
    this.bindShowcase();
    this.bindTimeline();
    this.bindBench();
    this.listenWindow('keydown', (event) => {
      this.dial(event);
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.mountChild(this.overlays.boot, document.body);
    if (new URLSearchParams(window.location.search).has(DioramaComponent.PERF_PARAM)) {
      this.overlays.perf.connect(() => this.experience?.perf ?? null);
      this.mountChild(this.overlays.perf, document.body);
    }
    void this.start();
  }

  /**
   * Puntero sobre la escena: seguimiento, clics, arrastre y perillas del osciloscopio. La perilla se toma en
   * la fase de captura, antes de que la cámara empiece a girar.
   */
  private bindPointer(): void {
    this.listenWindow('pointermove', (event) => {
      this.moveDrag(event);
      this.turnKnob(event);
      this.track(event);
    });
    const grab = (event: PointerEvent): void => {
      this.grabKnob(event);
    };
    this.listen(this.element, 'pointerdown', grab, true);
    this.listenWindow('click', (event) => {
      this.select(event);
    });
    this.listen(this.canvas, 'pointerdown', (event) => {
      this.startPress(event);
    });
    this.listenWindow('pointerup', () => {
      this.endDrag();
    });
  }

  /**
   * Sigue a la vitrina: el sabor de cada lata y cuál está elegida.
   */
  private bindShowcase(): void {
    this.subscriptions.push(
      this.events.on('showcaseSelected', (item) => {
        this.item = item;
        this.experience?.showItem(item);
      }),
      this.events.on('showcaseCans', (cans) => {
        this.showcaseCans = cans;
        this.experience?.setItems(cans);
      }),
      this.events.on('contactChannels', (channels) => {
        this.contacts = channels;
        this.experience?.setContacts(channels);
      }),
    );
  }

  /**
   * Sigue a la trayectoria: sus etapas son los breakers del tablero; elegir una en la vitrina abre el
   * tablero y subir un breaker en la escena la muestra en la vitrina.
   */
  private bindTimeline(): void {
    this.subscriptions.push(
      this.events.on('timelineDirectory', (directory) => {
        this.devices.panel.setDirectory(directory);
      }),
      this.events.on('timelineSelected', (index) => {
        this.devices.panel.select(index);
      }),
      this.devices.panel.on((event) => {
        if (event.type === 'picked') {
          this.events.emit('timelinePicked', event.index);
        }
      }),
    );
  }

  /**
   * Sigue a los proyectos: cada uno es una placa del taller; elegir uno en la vitrina lo lleva al banco y
   * tocar una placa en la escena lo muestra en la vitrina.
   */
  private bindBench(): void {
    const { bench } = this.devices;
    this.subscriptions.push(
      this.events.on('benchBoards', (boards) => {
        bench.setBoards(boards);
      }),
      this.events.on('benchSelected', (index) => {
        bench.select(index);
      }),
      bench.on((event) => {
        if (event.type === 'picked') {
          this.events.emit('benchPicked', event.index);
        }
      }),
    );
  }

  /**
   * Marca en el teléfono de la escena el número pulsado en el teclado físico (solo en la sección de
   * contacto y fuera de los campos de texto).
   *
   * @param event Evento de teclado.
   */
  private dial(event: KeyboardEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (!DioramaComponent.DIAL_KEY.test(event.key) || target?.closest('input, textarea')) {
      return;
    }
    if (this.experience?.dialPhone(event.key)) {
      event.preventDefault();
    }
  }

  /**
   * Arranca la experiencia: sonido, consola de arranque mientras compila la escena, y la intro.
   */
  private async start(): Promise<void> {
    this.factory.startSound();
    try {
      const experience = this.createExperience();
      await this.overlays.boot.play(this.prepare(experience));
      await this.overlays.boot.dismiss();
      this.connect(experience);
      await experience.powerOn(this.factory.prefersReducedMotion());
    } catch (error: unknown) {
      console.error(error);
      this.element.classList.add('diorama--fallback');
      await this.overlays.boot.dismiss();
    }
    this.finish();
  }

  /**
   * Conecta la experiencia con la navegación y con la vitrina.
   *
   * @param experience Experiencia ya preparada.
   */
  private connect(experience: DioramaExperience): void {
    this.navigator.setStops(experience.hotspots.map((hotspot) => hotspot.sectionId));
    this.subscriptions.push(
      this.navigator.onChange(() => {
        experience.travelTo(this.navigator.position);
      }),
    );
    experience.travelTo(this.navigator.position);
    experience.setItems(this.showcaseCans);
    experience.showItem(this.item);
    experience.setContacts(this.contacts);
    experience.onCall((channel) => {
      window.open(channel.href, '_blank', DioramaComponent.CALL_FEATURES);
    });
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
   * Muestra el botón de sonido y el riel, y avisa al resto de la app que la intro terminó.
   */
  private finish(): void {
    this.element.classList.add('diorama--ready');
    this.mountChild(this.overlays.soundToggle, document.body);
    if (this.experience) {
      this.overlays.nav.setStops(this.experience.hotspots);
      this.mountChild(this.overlays.nav, document.body);
    }
    this.events.emit('introComplete', undefined);
  }

  /**
   * Recuerda dónde se presionó, para distinguir un clic de un arrastre.
   *
   * @param event Evento de puntero.
   */
  private startPress(event: PointerEvent): void {
    this.press = { x: event.clientX, y: event.clientY };
    this.suppressClick = false;
  }

  /**
   * Marca el arrastre (para el cursor) cuando el puntero presionado se mueve lo suficiente.
   *
   * @param event Evento de puntero.
   */
  private moveDrag(event: PointerEvent): void {
    if (!this.press) {
      return;
    }
    const distance = Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y);
    if (distance > DioramaComponent.DRAG_THRESHOLD) {
      this.suppressClick = true;
      document.body.classList.add(DioramaComponent.DRAGGING_CLASS);
    }
  }

  /**
   * Suelta el arrastre.
   */
  private endDrag(): void {
    this.press = null;
    document.body.classList.remove(DioramaComponent.DRAGGING_CLASS);
    if (this.grabbedAt !== null) {
      this.grabbedAt = null;
      this.experience?.releaseControl();
      document.body.classList.remove(DioramaComponent.TUNING_CLASS);
    }
  }

  /**
   * Si el puntero baja sobre una tecla o perilla del osciloscopio, la usa (antes de que la cámara empiece a
   * girar).
   *
   * @param event Evento de puntero.
   */
  private grabKnob(event: PointerEvent): void {
    if (event.target !== this.canvas || !this.experience) {
      return;
    }
    this.track(event);
    if (this.experience.grabControl()) {
      this.grabbedAt = event.clientY;
      document.body.classList.add(DioramaComponent.TUNING_CLASS);
    }
  }

  /**
   * Gira la perilla tomada (si hay una) según el arrastre vertical.
   *
   * @param event Evento de puntero.
   */
  private turnKnob(event: PointerEvent): void {
    if (this.grabbedAt !== null) {
      this.suppressClick = true;
      this.experience?.turnControl(this.grabbedAt - event.clientY);
    }
  }

  /**
   * Actualiza el puntero (para detectar marcadores y latas) y el tooltip.
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
    const label = this.pointedLabel(this.experience);
    this.tooltip.textContent = label ?? '';
    this.tooltip.classList.toggle('diorama__tooltip--visible', label !== null);
    this.tooltip.style.transform = `translate(${String(event.clientX + DioramaComponent.TOOLTIP_OFFSET)}px, ${String(event.clientY)}px)`;
    document.body.classList.toggle('is-pointing', label !== null);
  }

  /**
   * Texto del tooltip para lo que está bajo el puntero: un marcador, una lata de la vitrina, un control del
   * osciloscopio o uno del equipo de la sección (teléfono o tablero), en ese orden.
   *
   * @param experience Experiencia 3D.
   * @returns Texto o `null` si no se señala nada interactivo.
   */
  private pointedLabel(experience: DioramaExperience): string | null {
    const hotspot = experience.hover();
    const item = experience.hoverItem();
    const control = experience.hoverControl();
    const device = experience.hoverDevice();
    if (hotspot) {
      return hotspot.label;
    }
    if (item !== null) {
      return experience.itemName(item);
    }
    return control === null ? device : experience.controlLabel(control);
  }

  /**
   * Si el clic cae sobre la escena (no sobre contenido ni al final de un arrastre), activa lo señalado.
   *
   * @param event Evento de clic.
   */
  private select(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    if (this.suppressClick || target?.closest(DioramaComponent.INTERACTIVE_SELECTOR)) {
      this.suppressClick = false;
      return;
    }
    this.track(event);
    if (this.experience) {
      this.activate(this.experience);
    }
  }

  /**
   * Activa lo que está bajo el puntero: un marcador lleva a su sección, una lata la elige en la vitrina
   * y lleva a la sección de la vitrina, y un control del teléfono o del tablero se usa.
   *
   * @param experience Experiencia 3D.
   */
  private activate(experience: DioramaExperience): void {
    const hotspot = experience.hover();
    const item = experience.hoverItem();
    if (hotspot) {
      experience.select();
      this.navigator.go(hotspot.sectionId);
    } else if (item !== null) {
      experience.select();
      this.events.emit('showcasePicked', item);
      this.navigator.go(experience.showcaseSection);
    } else {
      experience.pressDevice();
    }
  }
}
