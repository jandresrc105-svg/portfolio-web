import type { Camera } from 'three';
import type { ContactChannel } from '@shared/core/events/ContactChannel';
import { PointerPicker } from '@shared/engine/PointerPicker';
import type { Soundscape } from '../audio/Soundscape';
import type { DeviceInteraction } from '../models/DeviceInteraction';
import type { PhoneEvent } from '../models/PhoneEvent';
import { PayPhoneService } from '../services/PayPhoneService';
import type { PhoneBooth } from '../scene/objects/PhoneBooth';

/**
 * Conecta el teléfono de la cabina (patrón Mediator): el puntero toma el auricular, las teclas y la
 * pantalla; {@link PayPhoneService} decide qué pasa, y sus avisos mueven el auricular, redibujan la pantalla,
 * suenan y, al conectar una llamada, piden abrir el canal.
 */
export class PhoneInteraction implements DeviceInteraction {
  private static readonly COLUMNS = 3;

  private readonly picker = new PointerPicker<string>();
  private readonly unsubscribe: () => void;
  private hovered: string | null = null;
  private listener: ((channel: ContactChannel) => void) | null = null;
  private directory: readonly ContactChannel[] | null = null;

  /**
   * Registra los controles del teléfono y escucha sus avisos.
   *
   * @param phone Teléfono (estado y reglas).
   * @param booth Cabina con el teléfono 3D.
   * @param sound Paisaje sonoro.
   */
  public constructor(
    private readonly phone: PayPhoneService,
    private readonly booth: PhoneBooth,
    private readonly sound: Soundscape,
  ) {
    booth.controls(PayPhoneService.HOOK, PayPhoneService.SCREEN).forEach(({ id, hitArea }) => {
      this.picker.register(hitArea, id);
    });
    this.unsubscribe = phone.on((event) => {
      this.handle(event);
    });
    this.refresh();
  }

  /**
   * Avisa si la sección de contacto está abierta (al abrirla suena; al salir se cuelga).
   *
   * @param active Si está abierta.
   */
  public setActive(active: boolean): void {
    this.phone.setActive(active);
    if (!active) {
      this.highlight(null);
    }
  }

  /**
   * Define qué hacer cuando una llamada conecta (abrir el canal).
   *
   * @param listener Función que recibe el canal.
   */
  public onCall(listener: (channel: ContactChannel) => void): void {
    this.listener = listener;
  }

  /**
   * Actualiza el puntero.
   *
   * @param x Horizontal normalizado [-1, 1].
   * @param y Vertical normalizado [-1, 1].
   */
  public setPointer(x: number, y: number): void {
    this.picker.setPointer(x, y);
  }

  /**
   * Detecta el control del teléfono bajo el puntero, lo resalta y suena al entrar en uno nuevo.
   *
   * @param camera Cámara desde la que se mira.
   * @param enabled Si el teléfono responde ahora (sección abierta y nada delante).
   * @returns Texto del tooltip del control señalado o `null`.
   */
  public hover(camera: Camera, enabled: boolean): string | null {
    const id = enabled ? this.picker.pick(camera) : null;
    const usable = id !== null && this.phone.describe(id) !== null ? id : null;
    if (usable !== this.hovered) {
      this.highlight(usable);
      if (usable !== null) {
        this.sound.hover();
      }
    }
    return usable === null ? null : this.phone.describe(usable);
  }

  /**
   * Usa el control señalado, si hay uno.
   *
   * @returns `true` si se usó un control.
   */
  public press(): boolean {
    if (this.hovered === null) {
      return false;
    }
    this.phone.press(this.hovered);
    return true;
  }

  /**
   * Marca una tecla desde el teclado físico.
   *
   * @param key Tecla (`0`…`9`, `*`, `#`).
   */
  public dial(key: string): void {
    this.phone.press(key);
  }

  /**
   * Deja de escuchar al teléfono.
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Reacciona a un aviso del teléfono: los cambios de estado se ven en la escena y el resto suena o, al
   * conectar, abre el canal.
   *
   * @param event Aviso.
   */
  private handle(event: PhoneEvent): void {
    if (event.type === 'state') {
      this.refresh();
    } else if (event.type === 'key') {
      this.pressKey(event.key);
    } else if (event.type === 'connect') {
      this.listener?.(event.channel);
    } else {
      this.play(event);
    }
  }

  /**
   * Sonido de un aviso: chasquido del gancho, tono de la línea o timbre.
   *
   * @param event Aviso.
   */
  private play(event: PhoneEvent): void {
    if (event.type === 'hook') {
      this.sound.click();
    } else if (event.type === 'line') {
      this.sound.phoneLine(event.line);
    } else if (event.type === 'ring') {
      this.sound.phoneRing();
    }
  }

  /**
   * Hunde la tecla y hace sonar su tono DTMF.
   *
   * @param key Tecla.
   */
  private pressKey(key: string): void {
    this.booth.pressKey(key);
    const index = PayPhoneService.KEYS.indexOf(key);
    const columns = PhoneInteraction.COLUMNS;
    this.sound.phoneKey(Math.floor(index / columns), index % columns);
  }

  /**
   * Refleja el estado del teléfono en la escena: auricular, pantalla y (si cambió) tarjeta de marcado rápido.
   */
  private refresh(): void {
    this.booth.setLifted(this.phone.lifted);
    this.booth.setDisplay(this.phone.display);
    if (this.phone.directory !== this.directory) {
      this.directory = this.phone.directory;
      this.booth.setDirectory(this.directory.map((channel) => channel.label));
    }
  }

  /**
   * Resalta un control (y apaga el anterior).
   *
   * @param id Control o `null`.
   */
  private highlight(id: string | null): void {
    this.hovered = id;
    this.booth.highlight(id, PayPhoneService.HOOK);
  }
}
