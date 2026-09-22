import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';

/**
 * Pantalla de arranque tipo terminal que se muestra mientras la escena compila sus shaders.
 */
export class BootScreenComponent extends Component {
  private static readonly LINES = [
    { text: '> JR-OS v2.3 · inicializando sistema', status: '' },
    { text: '> calibrando sensores', status: 'OK' },
    { text: '> lazo PID  Kp=1.20  Ki=0.40  Kd=0.08', status: 'ESTABLE' },
    { text: '> compilando shaders', status: 'OK' },
    { text: '> cocinando el caldo', status: '12h' },
    { text: '> encendiendo luces', status: '…' },
  ];
  private static readonly LINE_DELAY_MS = 340;
  private static readonly FADE_OUT_MS = 900;
  private static readonly PERCENT = 100;

  private readonly log = ElementBuilder.create('div')
    .classes('boot__log')
    .attr('aria-live', 'polite')
    .build();
  private readonly bar = ElementBuilder.create('span').classes('boot__progress').build();

  /**
   * Escribe las líneas de arranque una por una.
   *
   * @returns Promesa que se resuelve al escribir la última línea.
   */
  public async play(): Promise<void> {
    const lines = BootScreenComponent.LINES;
    for (const [index, line] of lines.entries()) {
      this.log.append(BootScreenComponent.line(line.text, line.status));
      this.bar.style.width = `${String(((index + 1) / lines.length) * BootScreenComponent.PERCENT)}%`;
      await BootScreenComponent.wait(BootScreenComponent.LINE_DELAY_MS);
    }
  }

  /**
   * Desvanece la pantalla y la retira.
   *
   * @returns Promesa que se resuelve cuando ya no es visible.
   */
  public async dismiss(): Promise<void> {
    if (!this.isMounted) {
      return;
    }
    this.element.classList.add('boot--hidden');
    await BootScreenComponent.wait(BootScreenComponent.FADE_OUT_MS);
    this.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    const terminal = ElementBuilder.create('div')
      .classes('boot__terminal')
      .children(this.log, ElementBuilder.create('div').classes('boot__bar').children(this.bar).build())
      .build();
    return ElementBuilder.create('div').classes('boot').attr('role', 'status').children(terminal).build();
  }

  /**
   * La pantalla de arranque no tiene interacción.
   */
  protected override bindEvents(): void {}

  /**
   * Crea una línea del log con su estado alineado a la derecha.
   *
   * @param text Texto de la línea.
   * @param status Estado ("OK", "ESTABLE"…).
   * @returns Elemento de la línea.
   */
  private static line(text: string, status: string): HTMLElement {
    return ElementBuilder.create('p')
      .classes('boot__line')
      .children(
        ElementBuilder.create('span').text(text).build(),
        ElementBuilder.create('span').classes('boot__status').text(status).build(),
      )
      .build();
  }

  /**
   * Espera un tiempo.
   *
   * @param milliseconds Milisegundos.
   * @returns Promesa que se resuelve al terminar la espera.
   */
  private static wait(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }
}
