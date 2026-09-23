import type { Camera } from 'three';
import { PointerPicker } from '@shared/engine/PointerPicker';
import type { Soundscape } from '../audio/Soundscape';
import type { DeviceInteraction } from '../models/DeviceInteraction';
import type { WorkshopDevice } from '../models/WorkshopDevice';

/**
 * Todo el taller como un solo equipo de la sección (patrón Composite): reúne los controles de cada
 * {@link WorkshopDevice} en un mismo selector (gana el más cercano al puntero) y, si no hay ninguno, le pasa
 * el puntero a los equipos con conexión propia (el banco de los proyectos). Resalta, suena al entrar en un
 * control, pulsa con un clic y entrega el arrastre de las perillas.
 */
export class WorkshopInteraction implements DeviceInteraction {
  private readonly picker = new PointerPicker<{ device: WorkshopDevice; id: string }>();
  private hovered: { device: WorkshopDevice; id: string } | null = null;

  /**
   * Registra los controles de todos los equipos.
   *
   * @param devices Equipos del catálogo del taller.
   * @param others Equipos con conexión propia, que se prueban después.
   * @param sound Paisaje sonoro.
   */
  public constructor(
    private readonly devices: readonly WorkshopDevice[],
    private readonly others: readonly DeviceInteraction[],
    private readonly sound: Soundscape,
  ) {
    devices.forEach((device) => {
      device.controls().forEach(({ id, hitArea }) => {
        this.picker.register(hitArea, { device, id });
      });
    });
  }

  /**
   * @inheritdoc
   */
  public setActive(active: boolean): void {
    this.devices.forEach((device) => {
      device.setActive(active);
    });
    this.others.forEach((other) => {
      other.setActive(active);
    });
    if (!active) {
      this.highlight(null);
    }
  }

  /**
   * @inheritdoc
   */
  public setPointer(x: number, y: number): void {
    this.picker.setPointer(x, y);
    this.others.forEach((other) => {
      other.setPointer(x, y);
    });
  }

  /**
   * @inheritdoc
   */
  public hover(camera: Camera, enabled: boolean): string | null {
    const target = enabled ? this.picker.pick(camera) : null;
    const label = target ? target.device.describe(target.id) : null;
    const usable = label === null ? null : target;
    if (!WorkshopInteraction.same(usable, this.hovered)) {
      this.highlight(usable);
      if (usable) {
        this.sound.hover();
      }
    }
    return label ?? this.hoverOthers(camera, enabled && usable === null);
  }

  /**
   * @inheritdoc
   */
  public press(): boolean {
    if (this.hovered) {
      this.hovered.device.press(this.hovered.id);
      this.sound.click();
      return true;
    }
    return this.others.some((other) => other.press());
  }

  /**
   * @inheritdoc
   */
  public grab(): ((pixels: number) => void) | null {
    const target = this.hovered;
    const apply = target ? target.device.grab(target.id) : null;
    if (apply) {
      this.sound.select();
    }
    return apply;
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.devices.forEach((device) => {
      device.dispose();
    });
    this.others.forEach((other) => {
      other.dispose();
    });
  }

  /**
   * Pasa el puntero a los equipos con conexión propia (el primero que responde gana).
   *
   * @param camera Cámara.
   * @param enabled Si pueden responder (no hay un control del catálogo delante).
   * @returns Tooltip o `null`.
   */
  private hoverOthers(camera: Camera, enabled: boolean): string | null {
    let label: string | null = null;
    this.others.forEach((other) => {
      const text = other.hover(camera, enabled && label === null);
      label ??= text;
    });
    return label;
  }

  /**
   * Resalta un control (y apaga el anterior).
   *
   * @param target Control o `null`.
   */
  private highlight(target: { device: WorkshopDevice; id: string } | null): void {
    if (this.hovered && this.hovered.device !== target?.device) {
      this.hovered.device.highlight(null);
    }
    this.hovered = target;
    target?.device.highlight(target.id);
  }

  /**
   * Indica si dos controles señalados son el mismo.
   *
   * @param a Control o `null`.
   * @param b Control o `null`.
   * @returns `true` si son el mismo (o ambos `null`).
   */
  private static same(
    a: { device: WorkshopDevice; id: string } | null,
    b: { device: WorkshopDevice; id: string } | null,
  ): boolean {
    return a?.device === b?.device && a?.id === b?.id;
  }
}
