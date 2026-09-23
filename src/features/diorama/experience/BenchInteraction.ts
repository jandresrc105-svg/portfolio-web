import type { Camera } from 'three';
import { PointerPicker } from '@shared/engine/PointerPicker';
import type { Soundscape } from '../audio/Soundscape';
import type { BenchEvent } from '../models/BenchEvent';
import type { DeviceInteraction } from '../models/DeviceInteraction';
import type { Workbench } from '../scene/workshop/Workbench';
import type { WorkbenchService } from '../services/WorkbenchService';

/**
 * Conecta el banco del taller (patrón Mediator): el puntero toma las placas, la fuente y la lámpara,
 * {@link WorkbenchService} decide qué pasa y sus avisos mueven las placas, prenden o apagan los equipos y
 * suenan.
 */
export class BenchInteraction implements DeviceInteraction {
  private readonly picker = new PointerPicker<string>();
  private readonly unsubscribe: () => void;
  private hovered: string | null = null;

  /**
   * Registra los controles del banco y escucha sus avisos.
   *
   * @param bench Banco (estado y reglas).
   * @param scene Banco 3D.
   * @param sound Paisaje sonoro.
   */
  public constructor(
    private readonly bench: WorkbenchService,
    private readonly scene: Workbench,
    private readonly sound: Soundscape,
  ) {
    scene.controls().forEach(({ id, hitArea }) => {
      this.picker.register(hitArea, id);
    });
    this.unsubscribe = bench.on((event) => {
      this.handle(event);
    });
    scene.setState(bench.state);
  }

  /**
   * @inheritdoc
   */
  public setActive(active: boolean): void {
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
    const label = id === null ? null : this.bench.describe(id);
    const usable = label === null ? null : id;
    if (usable !== this.hovered) {
      this.highlight(usable);
      if (usable !== null) {
        this.sound.hover();
      }
    }
    return label;
  }

  /**
   * @inheritdoc
   */
  public press(): boolean {
    if (this.hovered === null) {
      return false;
    }
    this.bench.press(this.hovered);
    return true;
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Reacciona a un aviso del banco: los cambios se ven en la escena, los interruptores suenan y elegir una
   * placa suena como una selección.
   *
   * @param event Aviso.
   */
  private handle(event: BenchEvent): void {
    if (event.type === 'state') {
      this.scene.setState(this.bench.state);
    } else if (event.type === 'switch') {
      this.sound.click();
    } else {
      this.sound.select();
    }
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
