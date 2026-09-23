import { PlasmaHum } from '../../audio/PlasmaHum';
import { SwitchSound } from '../../audio/SwitchSound';
import { ShopLightsControl } from '../../models/ShopLightsControl';
import type { ShopLightsEvent } from '../../models/ShopLightsEvent';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { ShopLightsService } from '../../services/ShopLightsService';
import { ShopLightsPiece } from './ShopLightsPiece';

/**
 * Equipo "luces y ambiente" del taller (Mediator): une el service de las luces con su pieza 3D y con los
 * sonidos (el clac de cada palanca y el zumbido de la bola de plasma). El dimmer se arrastra; lo demás se
 * acciona con un clic. El zumbido solo suena con el taller en pantalla.
 */
export class ShopLightsDevice implements WorkshopDevice {
  private static readonly DRAG = { pixels: 220 };

  public readonly piece: ShopLightsPiece;

  private readonly service = new ShopLightsService();
  private readonly unsubscribe: () => void;
  private sound: { hum: PlasmaHum; click: SwitchSound } | null = null;
  private active = false;
  private touched = false;

  /**
   * Crea el equipo.
   *
   * @param context Materiales, texturas, ubicación, audio y azar del taller.
   */
  public constructor(private readonly context: WorkshopContext) {
    this.piece = new ShopLightsPiece(context);
    this.piece.show(this.service.state);
    this.unsubscribe = this.service.on((event) => {
      this.onEvent(event);
    });
  }

  /**
   * @inheritdoc
   */
  public controls(): readonly WorkshopControl[] {
    return this.piece.controls();
  }

  /**
   * @inheritdoc
   */
  public describe(id: string): string | null {
    return this.service.describe(id);
  }

  /**
   * @inheritdoc
   */
  public press(id: string): void {
    this.service.press(id);
  }

  /**
   * @inheritdoc
   */
  public grab(id: string): ((pixels: number) => void) | null {
    if (id !== (ShopLightsControl.Dimmer as string)) {
      return null;
    }
    const start = this.service.state.dimmer;
    return (pixels: number): void => {
      this.service.setDimmer(start + pixels / ShopLightsDevice.DRAG.pixels);
    };
  }

  /**
   * @inheritdoc
   */
  public highlight(id: string | null): void {
    this.piece.highlight(id);
    this.touched = id === (ShopLightsControl.Globe as string);
    this.voices()?.hum.setTouched(this.touched);
    this.syncHum();
  }

  /**
   * @inheritdoc
   */
  public setActive(active: boolean): void {
    this.active = active;
    this.syncHum();
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
    this.sound?.hum.setRunning(false);
  }

  /**
   * Lleva cada aviso del service a la escena y al sonido.
   *
   * @param event Aviso.
   */
  private onEvent(event: ShopLightsEvent): void {
    this.piece.show(this.service.state);
    if (event.type === 'switch') {
      this.voices()?.click.play();
    }
    this.syncHum();
  }

  /**
   * Prende el zumbido si la bola está encendida y el taller en pantalla.
   */
  private syncHum(): void {
    const running = this.active && this.service.state.plasma;
    const voices = running ? this.voices() : this.sound;
    voices?.hum.setRunning(running);
  }

  /**
   * Sonidos del equipo, creados la primera vez que el navegador deja sonar.
   *
   * @returns Sonidos o `null` si aún no hay audio.
   */
  private voices(): { hum: PlasmaHum; click: SwitchSound } | null {
    if (this.sound) {
      return this.sound;
    }
    const { audioContext, output } = this.context.audio;
    if (!audioContext || !output) {
      return null;
    }
    this.sound = { hum: new PlasmaHum(audioContext, output), click: new SwitchSound(audioContext, output) };
    this.sound.hum.setTouched(this.touched);
    return this.sound;
  }
}
