import type { DioramaComponent } from '@features/diorama/components/DioramaComponent';
import type { HeroComponent } from '@features/hero/components/HeroComponent';
import type { SectionsComponent } from '@features/sections/components/SectionsComponent';
import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';

/**
 * Contenedor principal de la aplicación. Solo compone las features; no tiene lógica propia.
 * El diorama queda fijo al fondo y el contenido se desplaza por encima.
 */
export class App extends Component {
  private readonly content = ElementBuilder.create('main').classes('app__content').build();

  /**
   * Crea el contenedor principal con las features que compone.
   *
   * @param diorama Escena 3D de fondo.
   * @param hero Presentación inicial.
   * @param sections Secciones de contenido.
   */
  public constructor(
    private readonly diorama: DioramaComponent,
    private readonly hero: HeroComponent,
    private readonly sections: SectionsComponent,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    return ElementBuilder.create('div').classes('app').build();
  }

  /**
   * El contenedor principal no tiene eventos propios; cada feature gestiona los suyos.
   */
  protected override bindEvents(): void {}

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.mountChild(this.diorama);
    this.element.append(this.content);
    this.mountChild(this.hero, this.content);
    this.mountChild(this.sections, this.content);
  }
}
