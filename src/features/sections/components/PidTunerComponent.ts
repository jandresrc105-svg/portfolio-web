import type { GainLimits } from '@shared/control/GainLimits';
import type { PidLoopService } from '@shared/control/PidLoopService';
import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';

/**
 * Panel para sintonizar en vivo el lazo del osciloscopio: un deslizador por ganancia (Kp, Ki, Kd) y por
 * parámetro de la referencia (amplitud y frecuencia de la onda cuadrada), las mediciones del escalón y un
 * botón para volver a los valores de fábrica. Comparte el lazo con las perillas del osciloscopio 3D: si el
 * visitante las gira, los deslizadores lo siguen.
 */
export class PidTunerComponent extends Component {
  private static readonly ROWS = [
    { key: 'kp', group: 'gain', name: 'Kp', hint: 'Proporcional', unit: '' },
    { key: 'ki', group: 'gain', name: 'Ki', hint: 'Integral', unit: '' },
    { key: 'kd', group: 'gain', name: 'Kd', hint: 'Derivativo', unit: '' },
    { key: 'amplitude', group: 'signal', name: 'Amp', hint: 'Amplitud de la referencia', unit: ' V' },
    { key: 'frequency', group: 'signal', name: 'Frec', hint: 'Frecuencia de la referencia', unit: ' Hz' },
  ] as const;
  private static readonly GAIN_ROWS = 3;
  private static readonly FILL_PROPERTY = '--fill';
  private static readonly PERCENT = 100;
  private static readonly EMPTY = '—';

  private readonly rows: {
    spec: (typeof PidTunerComponent.ROWS)[number];
    slider: HTMLInputElement;
    value: HTMLOutputElement;
  }[];
  private readonly overshoot = PidTunerComponent.metricValue();
  private readonly settling = PidTunerComponent.metricValue();
  private readonly error = PidTunerComponent.metricValue();
  private readonly reset = ElementBuilder.create('button')
    .classes('tuner__reset')
    .attr('type', 'button')
    .text('Restablecer')
    .build();
  private unsubscribe: (() => void) | null = null;

  /**
   * Crea el panel.
   *
   * @param loop Lazo PID compartido con el osciloscopio.
   */
  public constructor(private readonly loop: PidLoopService) {
    super();
    this.rows = PidTunerComponent.ROWS.map((spec) => ({
      spec,
      slider: this.slider(spec),
      value: ElementBuilder.create('output').classes('tuner__value').build(),
    }));
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
    const heading = PidTunerComponent.heading('Sintoniza el lazo · o usa las perillas del osciloscopio');
    const reference = PidTunerComponent.heading('Referencia r(t) · onda cuadrada');
    const rows = this.rows.map((row) => PidTunerComponent.row(row));
    const split = PidTunerComponent.GAIN_ROWS;
    return ElementBuilder.create('div')
      .classes('tuner')
      .attr('role', 'group')
      .attr('aria-label', 'Sintonía del controlador PID')
      .children(heading, ...rows.slice(0, split), reference, ...rows.slice(split), this.metrics(), this.reset)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.rows.forEach(({ spec, slider }) => {
      this.listen(slider, 'input', () => {
        this.apply(spec, Number(slider.value));
      });
    });
    this.listen(this.reset, 'click', () => {
      this.loop.reset();
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.unsubscribe = this.loop.onChange(() => {
      this.sync();
    });
    this.sync();
  }

  /**
   * Muestra los valores y mediciones actuales.
   */
  private sync(): void {
    this.rows.forEach(({ spec, slider, value }) => {
      const { min, max, step } = this.limits(spec);
      const current = this.read(spec);
      slider.value = String(current);
      const fill = ((current - min) / (max - min)) * PidTunerComponent.PERCENT;
      slider.style.setProperty(PidTunerComponent.FILL_PROPERTY, `${String(fill)}%`);
      value.value = `${current.toFixed(PidTunerComponent.decimals(step))}${spec.unit}`;
    });
    const { metrics } = this.loop;
    const seconds = (time: number | null): string =>
      time === null ? PidTunerComponent.EMPTY : `${time.toFixed(2)} s`;
    this.overshoot.textContent = `${metrics.overshoot.toFixed(1)} %`;
    this.settling.textContent = seconds(metrics.settlingTime);
    this.error.textContent = `${metrics.steadyError.toFixed(1)} %`;
  }

  /**
   * Valor actual de una fila.
   *
   * @param spec Fila.
   * @returns Valor.
   */
  private read(spec: (typeof PidTunerComponent.ROWS)[number]): number {
    return spec.group === 'gain' ? this.loop.gains[spec.key] : this.loop.signal[spec.key];
  }

  /**
   * Rango y paso de una fila.
   *
   * @param spec Fila.
   * @returns Límites.
   */
  private limits(spec: (typeof PidTunerComponent.ROWS)[number]): GainLimits {
    return spec.group === 'gain' ? this.loop.limits[spec.key] : this.loop.signalLimits[spec.key];
  }

  /**
   * Aplica el valor de un deslizador al lazo.
   *
   * @param spec Fila.
   * @param value Valor nuevo.
   */
  private apply(spec: (typeof PidTunerComponent.ROWS)[number], value: number): void {
    if (spec.group === 'gain') {
      this.loop.tune({ [spec.key]: value });
    } else {
      this.loop.setSignal({ [spec.key]: value });
    }
  }

  /**
   * Mediciones del escalón: sobrepico, asentamiento y error final.
   *
   * @returns Lista de mediciones.
   */
  private metrics(): HTMLElement {
    const entries = [
      { term: 'Sobrepico', value: this.overshoot },
      { term: 'Asentamiento', value: this.settling },
      { term: 'Error final', value: this.error },
    ].map(({ term, value }) =>
      ElementBuilder.create('div')
        .classes('tuner__metric')
        .children(ElementBuilder.create('dt').classes('tuner__term').text(term).build(), value)
        .build(),
    );
    return ElementBuilder.create('dl')
      .classes('tuner__metrics')
      .children(...entries)
      .build();
  }

  /**
   * Deslizador de una fila con su rango y paso.
   *
   * @param spec Fila.
   * @returns Deslizador.
   */
  private slider(spec: (typeof PidTunerComponent.ROWS)[number]): HTMLInputElement {
    const { min, max, step } = this.limits(spec);
    return ElementBuilder.create('input')
      .classes('tuner__slider')
      .attr('type', 'range')
      .attr('min', String(min))
      .attr('max', String(max))
      .attr('step', String(step))
      .attr('aria-label', spec.hint)
      .build();
  }

  /**
   * Fila: nombre, deslizador y valor.
   *
   * @param row Especificación, deslizador y salida del valor.
   * @param row.spec Especificación de la fila.
   * @param row.slider Deslizador.
   * @param row.value Salida del valor.
   * @returns Fila.
   */
  private static row(row: {
    spec: (typeof PidTunerComponent.ROWS)[number];
    slider: HTMLInputElement;
    value: HTMLOutputElement;
  }): HTMLElement {
    const label = ElementBuilder.create('span')
      .classes('tuner__name')
      .attr('title', row.spec.hint)
      .text(row.spec.name)
      .build();
    return ElementBuilder.create('label')
      .classes('tuner__row')
      .children(label, row.slider, row.value)
      .build();
  }

  /**
   * Subtítulo del panel.
   *
   * @param text Texto.
   * @returns Elemento del subtítulo.
   */
  private static heading(text: string): HTMLElement {
    return ElementBuilder.create('p').classes('tuner__heading').text(text).build();
  }

  /**
   * Valor de una medición.
   *
   * @returns Elemento del valor.
   */
  private static metricValue(): HTMLElement {
    return ElementBuilder.create('dd').classes('tuner__metric-value').build();
  }

  /**
   * Decimales que se muestran para un paso de ajuste.
   *
   * @param step Paso.
   * @returns Cantidad de decimales.
   */
  private static decimals(step: number): number {
    return Math.max(0, -Math.floor(Math.log10(step)));
  }
}
