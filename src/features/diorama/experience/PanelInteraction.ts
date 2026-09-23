import type { Camera } from 'three';
import type { TimelineDirectory } from '@shared/core/events/TimelineDirectory';
import { PointerPicker } from '@shared/engine/PointerPicker';
import type { Soundscape } from '../audio/Soundscape';
import type { DeviceInteraction } from '../models/DeviceInteraction';
import type { PanelEvent } from '../models/PanelEvent';
import type { BreakerPanelService } from '../services/BreakerPanelService';
import type { BreakerPanel } from '../scene/panel/BreakerPanel';
import type { SwitchedLine } from '../scene/SwitchedLine';

/**
 * Conecta el tablero del poste (patrón Mediator): el puntero toma la puerta y las palancas,
 * {@link BreakerPanelService} decide qué pasa y sus avisos mueven la puerta y las palancas, encienden o apagan
 * la farola a través del MAIN y suenan.
 */
export class PanelInteraction implements DeviceInteraction {
  private readonly picker = new PointerPicker<string>();
  private readonly unsubscribe: () => void;
  private hovered: string | null = null;
  private directory: TimelineDirectory | null = null;

  /**
   * Registra los controles del tablero y escucha sus avisos.
   *
   * @param panel Tablero (estado y reglas).
   * @param scene Tablero 3D.
   * @param street Línea de la farola, detrás del MAIN.
   * @param sound Paisaje sonoro.
   */
  public constructor(
    private readonly panel: BreakerPanelService,
    private readonly scene: BreakerPanel,
    private readonly street: SwitchedLine,
    private readonly sound: Soundscape,
  ) {
    scene.controls().forEach(({ id, hitArea }) => {
      this.picker.register(hitArea, id);
    });
    this.unsubscribe = panel.on((event) => {
      this.handle(event);
    });
    this.refresh();
  }

  /**
   * @inheritdoc
   */
  public setActive(active: boolean): void {
    this.panel.setActive(active);
    if (!active) {
      this.highlight(null);
    }
  }

  /**
   * @inheritdoc
   */
  public setPointer(x: number, y: number): void {
    this.picker.setPointer(x, y);
  }

  /**
   * @inheritdoc
   */
  public hover(camera: Camera, enabled: boolean): string | null {
    const id = enabled ? this.picker.pick(camera) : null;
    const usable = id !== null && this.panel.describe(id) !== null ? id : null;
    if (usable !== this.hovered) {
      this.highlight(usable);
      if (usable !== null) {
        this.sound.hover();
      }
    }
    return usable === null ? null : this.panel.describe(usable);
  }

  /**
   * @inheritdoc
   */
  public press(): boolean {
    if (this.hovered === null) {
      return false;
    }
    this.panel.press(this.hovered);
    return true;
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Reacciona a un aviso del tablero: los cambios se ven en la escena y las palancas y la puerta suenan.
   *
   * @param event Aviso.
   */
  private handle(event: PanelEvent): void {
    if (event.type === 'state') {
      this.refresh();
    } else if (event.type === 'switch') {
      this.sound.click();
    } else if (event.type === 'door') {
      this.sound.select();
    }
  }

  /**
   * Refleja el estado del tablero en la escena: etiquetas, palancas, medidor y farola.
   */
  private refresh(): void {
    const state = this.panel.state;
    if (this.panel.labels !== this.directory) {
      this.directory = this.panel.labels;
      this.scene.setDirectory(this.directory.breakers, this.directory.seals);
    }
    this.scene.setState(state);
    this.scene.setReading(this.panel.years(new Date()));
    this.street.setClosed(state.main);
  }

  /**
   * Resalta un control (y apaga el anterior).
   *
   * @param id Control o `null`.
   */
  private highlight(id: string | null): void {
    this.hovered = id;
    this.scene.highlight(id);
  }
}
