import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';

/**
 * Consola de arranque: ventana de terminal que escribe un comando, muestra un log estilo kernel/systemd
 * y una barra de progreso ligada a la preparación real de la escena. Al terminar entra sola a la experiencia.
 */
export class BootScreenComponent extends Component {
  private static readonly TITLE = 'jr@ramen-os: ~ — bash — 80×24';
  private static readonly PROMPT = 'jr@ramen-os:~$ ';
  private static readonly BOOT_COMMAND = './encender_puesto.sh --lluvia --neon';
  private static readonly EXIT_COMMAND = 'startx';
  private static readonly KERNEL_LOG = [
    'ramen-kernel 2.3.0-jr #1 SMP PREEMPT',
    'Detectando hardware: osciloscopio, placa PID, 2 faroles, 1 máquina expendedora',
  ];
  private static readonly SERVICES = [
    { status: 'OK', text: 'Montando /dev/neon' },
    { status: 'OK', text: 'Calibrando sensores de humedad' },
    { status: 'OK', text: 'Lazo PID sintonizado · Kp=1.20 Ki=0.40 Kd=0.08' },
    { status: 'OK', text: 'Caldo tonkotsu · 12 h a 95 °C' },
    { status: 'INFO', text: 'Audio: lluvia + lofi (CC0)' },
  ];
  private static readonly TIMING = { char: 26, line: 140, pause: 280, progress: 70, fade: 700 };
  private static readonly PROGRESS = { width: 24, cap: 0.94, easing: 0.06, label: 'Compilando shaders' };
  private static readonly TIMESTAMP_STEP = 0.004211;
  private static readonly PERCENT = 100;
  private static readonly STATUS_WIDTH = 6;
  private static readonly STAMP_WIDTH = 12;
  private static readonly STAMP_DECIMALS = 6;

  private readonly output = ElementBuilder.create('div').classes('console__output').build();
  private readonly input = ElementBuilder.create('span').classes('console__input').build();
  private readonly promptLine = ElementBuilder.create('p')
    .classes('console__line')
    .children(
      ElementBuilder.create('span').classes('console__prompt').text(BootScreenComponent.PROMPT).build(),
      this.input,
      ElementBuilder.create('span').classes('console__cursor').attr('aria-hidden', 'true').build(),
    )
    .build();
  private timestamp = 0;

  /**
   * Reproduce la secuencia completa mientras la escena se prepara.
   *
   * @param ready Promesa que se resuelve cuando la escena está lista (si falla, el error se propaga).
   * @returns Promesa que se resuelve al escribir el comando final.
   */
  public async play(ready: Promise<void>): Promise<void> {
    await this.type(BootScreenComponent.BOOT_COMMAND);
    await this.printKernelLog();
    await this.printServices();
    await this.progress(ready);
    await this.type(BootScreenComponent.EXIT_COMMAND);
  }

  /**
   * Desvanece la consola y la retira.
   *
   * @returns Promesa que se resuelve cuando ya no es visible.
   */
  public async dismiss(): Promise<void> {
    if (!this.isMounted) {
      return;
    }
    this.element.classList.add('boot--hidden');
    await BootScreenComponent.wait(BootScreenComponent.TIMING.fade);
    this.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLElement {
    const bar = ElementBuilder.create('div')
      .classes('console__titlebar')
      .children(
        ElementBuilder.create('span').classes('console__dots').attr('aria-hidden', 'true').build(),
        ElementBuilder.create('span').classes('console__title').text(BootScreenComponent.TITLE).build(),
      )
      .build();
    const screen = ElementBuilder.create('div')
      .classes('console__screen')
      .children(this.output, this.promptLine)
      .build();
    const frame = ElementBuilder.create('div').classes('console').children(bar, screen).build();
    return ElementBuilder.create('div').classes('boot').attr('role', 'status').children(frame).build();
  }

  /**
   * La consola de arranque no tiene interacción.
   */
  protected override bindEvents(): void {}

  /**
   * Escribe un comando letra por letra y lo pasa al historial.
   *
   * @param command Comando a escribir.
   */
  private async type(command: string): Promise<void> {
    for (const character of command) {
      this.input.textContent = `${this.input.textContent}${character}`;
      await BootScreenComponent.wait(BootScreenComponent.TIMING.char);
    }
    await BootScreenComponent.wait(BootScreenComponent.TIMING.pause);
    this.print(BootScreenComponent.line('console__line', `${BootScreenComponent.PROMPT}${command}`));
    this.input.textContent = '';
  }

  /**
   * Imprime el log del kernel con marcas de tiempo.
   */
  private async printKernelLog(): Promise<void> {
    for (const text of BootScreenComponent.KERNEL_LOG) {
      this.timestamp += BootScreenComponent.TIMESTAMP_STEP;
      const stamp = `[${this.timestamp.toFixed(BootScreenComponent.STAMP_DECIMALS).padStart(BootScreenComponent.STAMP_WIDTH, ' ')}] `;
      this.print(BootScreenComponent.line('console__line console__line--dim', `${stamp}${text}`));
      await BootScreenComponent.wait(BootScreenComponent.TIMING.line);
    }
  }

  /**
   * Imprime el arranque de servicios estilo systemd.
   */
  private async printServices(): Promise<void> {
    for (const { status, text } of BootScreenComponent.SERVICES) {
      this.print(BootScreenComponent.service(status, text));
      await BootScreenComponent.wait(BootScreenComponent.TIMING.line);
    }
  }

  /**
   * Barra de progreso que avanza mientras la escena se prepara y se completa cuando está lista.
   *
   * @param ready Preparación de la escena.
   */
  private async progress(ready: Promise<void>): Promise<void> {
    const line = BootScreenComponent.line('console__line', '');
    this.print(line);
    const state = { done: false };
    const finished = ready.finally(() => {
      state.done = true;
    });
    let value = 0;
    while (!state.done) {
      value += (BootScreenComponent.PROGRESS.cap - value) * BootScreenComponent.PROGRESS.easing;
      line.textContent = BootScreenComponent.bar(value);
      await BootScreenComponent.wait(BootScreenComponent.TIMING.progress);
    }
    await finished;
    line.textContent = BootScreenComponent.bar(1);
    this.print(BootScreenComponent.service('OK', 'Escena lista'));
  }

  /**
   * Inserta una línea en la salida, antes del prompt.
   *
   * @param line Línea a insertar.
   */
  private print(line: HTMLElement): void {
    this.output.append(line);
  }

  /**
   * Texto de la barra de progreso ASCII.
   *
   * @param value Progreso [0, 1].
   * @returns Línea con la barra y el porcentaje.
   */
  private static bar(value: number): string {
    const { width, label } = BootScreenComponent.PROGRESS;
    const filled = Math.round(value * width);
    const percent = String(Math.round(value * BootScreenComponent.PERCENT)).padStart(3, ' ');
    return `${label}  [${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${percent}%`;
  }

  /**
   * Línea de servicio con su estado entre corchetes.
   *
   * @param status Estado ("OK", "INFO").
   * @param text Descripción.
   * @returns Elemento de la línea.
   */
  private static service(status: string, text: string): HTMLElement {
    const badge = ElementBuilder.create('span')
      .classes('console__status', `console__status--${status.toLowerCase()}`)
      .text(`[${BootScreenComponent.center(status)}]`)
      .build();
    return ElementBuilder.create('p')
      .classes('console__line')
      .children(badge, document.createTextNode(` ${text}`))
      .build();
  }

  /**
   * Centra un estado en el ancho fijo de las etiquetas de systemd.
   *
   * @param status Estado.
   * @returns Estado centrado ("  OK  ", " INFO ").
   */
  private static center(status: string): string {
    const left = Math.floor((BootScreenComponent.STATUS_WIDTH - status.length) / 2);
    return status.padStart(status.length + left, ' ').padEnd(BootScreenComponent.STATUS_WIDTH, ' ');
  }

  /**
   * Línea de texto simple.
   *
   * @param className Clases CSS.
   * @param text Contenido.
   * @returns Elemento de la línea.
   */
  private static line(className: string, text: string): HTMLElement {
    return ElementBuilder.create('p')
      .classes(...className.split(' '))
      .text(text)
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
