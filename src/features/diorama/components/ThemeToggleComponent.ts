import { Component } from '@shared/core/component/Component';
import { ElementBuilder } from '@shared/core/dom/ElementBuilder';
import { DayPhase } from '@shared/theme/DayPhase';
import { ThemeMode } from '@shared/theme/ThemeMode';
import type { ThemeService } from '@shared/theme/ThemeService';
import type { ThemeState } from '@shared/theme/ThemeState';
import { DaylightDirector } from '../experience/DaylightDirector';

/**
 * Selector de apariencia: día (el puesto a pleno sol), tarde (al atardecer), noche (con los neones) u hora local
 * (según el reloj del visitante). Los colores de la página son claros de día, oscuros de noche y, de tarde,
 * oscuros con los acentos más claros para que se lean sobre el cielo del atardecer. Aplica la apariencia a la página (`data-theme` en `<html>`, del que cuelgan los colores) desde que
 * se monta, aunque el selector se muestre recién al terminar la intro ({@link ThemeToggleComponent.reveal}), y
 * vuelve a mirar la hora cada minuto para que la hora local cambie sola. Al cambiar, los colores de la página
 * cambian a mitad del amanecer o del atardecer de la escena.
 */
export class ThemeToggleComponent extends Component<HTMLDivElement> {
  private static readonly OPTIONS = [
    { mode: ThemeMode.Light, glyph: '☀', label: 'Día', hint: 'Día: el puesto a pleno sol' },
    { mode: ThemeMode.Dusk, glyph: '◐', label: 'Tarde', hint: 'Tarde: el puesto al atardecer' },
    { mode: ThemeMode.Dark, glyph: '☾', label: 'Noche', hint: 'Noche: el puesto con los neones' },
    {
      mode: ThemeMode.Local,
      glyph: '◷',
      label: 'Hora local',
      hint: 'Según tu hora: de día, de tarde o de noche',
    },
  ];
  private static readonly PALETTES: ReadonlyMap<DayPhase, string> = new Map([
    [DayPhase.Day, 'light'],
    [DayPhase.Dusk, 'dusk'],
    [DayPhase.Night, 'dark'],
  ]);
  private static readonly REFRESH_MS = 60_000;
  private static readonly VISIBLE_CLASS = 'theme-toggle--visible';
  private static readonly ACTIVE_CLASS = 'theme-toggle__option--active';
  private static readonly NOW: ReadonlyMap<DayPhase, string> = new Map([
    [DayPhase.Day, 'ahora es de día'],
    [DayPhase.Dusk, 'ahora es de tarde'],
    [DayPhase.Night, 'ahora es de noche'],
  ]);

  private readonly buttons = new Map<ThemeMode, HTMLButtonElement>();
  private unsubscribe: (() => void) | null = null;
  private timer: number | null = null;
  private pending: number | null = null;
  private applied = false;

  /**
   * Crea el selector.
   *
   * @param theme Apariencia de la página.
   */
  public constructor(private readonly theme: ThemeService) {
    super();
  }

  /**
   * Muestra el selector (al terminar la intro).
   */
  public reveal(): void {
    this.element.classList.add(ThemeToggleComponent.VISIBLE_CLASS);
  }

  /**
   * @inheritdoc
   */
  public override unmount(): void {
    this.unsubscribe?.();
    if (this.timer !== null) {
      window.clearInterval(this.timer);
    }
    if (this.pending !== null) {
      window.clearTimeout(this.pending);
    }
    super.unmount();
  }

  /**
   * @inheritdoc
   */
  protected override render(): HTMLDivElement {
    const options = ThemeToggleComponent.OPTIONS.map((option) => this.option(option));
    return ElementBuilder.create('div')
      .classes('theme-toggle')
      .attr('role', 'group')
      .attr('aria-label', 'Apariencia')
      .children(...options)
      .build();
  }

  /**
   * @inheritdoc
   */
  protected override bindEvents(): void {
    this.buttons.forEach((button, mode) => {
      this.listen(button, 'click', () => {
        this.theme.setMode(mode);
      });
    });
  }

  /**
   * @inheritdoc
   */
  protected override onMount(): void {
    this.unsubscribe = this.theme.onChange((state) => {
      this.show(state);
    });
    this.timer = window.setInterval(() => {
      this.theme.refresh();
    }, ThemeToggleComponent.REFRESH_MS);
  }

  /**
   * Botón de un modo: ícono y nombre (en pantallas angostas solo el ícono).
   *
   * @param option Modo, ícono, nombre y descripción.
   * @returns Botón.
   */
  private option(option: (typeof ThemeToggleComponent.OPTIONS)[number]): HTMLButtonElement {
    const glyph = ElementBuilder.create('span')
      .classes('theme-toggle__glyph')
      .attr('aria-hidden', 'true')
      .text(option.glyph)
      .build();
    const label = ElementBuilder.create('span').classes('theme-toggle__label').text(option.label).build();
    const button = ElementBuilder.create('button')
      .classes('theme-toggle__option')
      .attr('type', 'button')
      .attr('title', option.hint)
      .children(glyph, label)
      .build();
    this.buttons.set(option.mode, button);
    return button;
  }

  /**
   * Cambia los colores de la página: de inmediato la primera vez y, después, a mitad del cambio de la escena.
   *
   * @param phase Momento del día (cada uno tiene su paleta: clara, de tarde u oscura).
   */
  private schedule(phase: DayPhase): void {
    const apply = (): void => {
      document.documentElement.dataset.theme = ThemeToggleComponent.PALETTES.get(phase);
    };
    if (this.pending !== null) {
      window.clearTimeout(this.pending);
    }
    if (!this.applied) {
      this.applied = true;
      apply();
      return;
    }
    this.pending = window.setTimeout(apply, DaylightDirector.HALFWAY_MS);
  }

  /**
   * Refleja la apariencia en la página y en los botones.
   *
   * @param state Modo elegido y momento del día.
   */
  private show(state: ThemeState): void {
    this.schedule(state.phase);
    this.buttons.forEach((button, mode) => {
      const active = mode === state.mode;
      button.classList.toggle(ThemeToggleComponent.ACTIVE_CLASS, active);
      button.setAttribute('aria-pressed', String(active));
    });
    const now = ThemeToggleComponent.NOW.get(state.phase) ?? '';
    this.buttons.get(ThemeMode.Local)?.setAttribute('aria-label', `Hora local (${now})`);
  }
}
