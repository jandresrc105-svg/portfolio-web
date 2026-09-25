import type { AudioEngine } from '@shared/audio/AudioEngine';
import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';

/**
 * Botón flotante para activar o silenciar el sonido, con un ecualizador animado cuando suena.
 */
export class SoundToggleComponent extends Component<HTMLButtonElement> {
  private static readonly BARS = 4;
  private static readonly ACTIVE_CLASS = 'sound-toggle--on';
  private static readonly LABELS = { on: 'Silenciar sonido', off: 'Activar sonido' };

  private readonly label = ElementBuilder.create('span').classes('sound-toggle__label').build();
  private unsubscribe: (() => void) | null = null;

  /**
   * Crea el botón.
   *
   * @param audio Motor de audio compartido.
   */
  public constructor(private readonly audio: AudioEngine) {
    super();
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.unsubscribe?.();
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLButtonElement {
    const bars = Array.from({ length: SoundToggleComponent.BARS }, () =>
      ElementBuilder.create('span').classes('sound-toggle__bar').build(),
    );
    const equalizer = ElementBuilder.create('span')
      .classes('sound-toggle__equalizer')
      .attr('aria-hidden', 'true')
      .children(...bars)
      .build();
    return ElementBuilder.create('button')
      .classes('sound-toggle')
      .attr('type', 'button')
      .children(equalizer, this.label)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.listen(this.element, 'click', () => {
      this.audio.toggle();
    });
    this.unsubscribe = this.audio.onChange((muted) => {
      this.show(muted);
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.show(this.audio.isMuted);
  }

  /**
   * Refleja el estado del audio en el botón.
   *
   * @param muted `true` si está silenciado.
   */
  private show(muted: boolean): void {
    const { on, off } = SoundToggleComponent.LABELS;
    this.element.classList.toggle(SoundToggleComponent.ACTIVE_CLASS, !muted);
    this.element.setAttribute('aria-pressed', String(!muted));
    this.element.setAttribute('aria-label', muted ? off : on);
    this.label.textContent = muted ? 'Sonido' : 'Sonido on';
  }
}
