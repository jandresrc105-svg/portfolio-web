import { ToolWallSound } from '../../audio/ToolWallSound';
import type { ToolWallEvent } from '../../models/ToolWallEvent';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { ToolWallService } from '../../services/ToolWallService';
import { ToolWallPiece } from './ToolWallPiece';

/**
 * Pared de herramientas como equipo del taller (patrón Mediator): une la pieza 3D, el service con el estado
 * y el sonido. Señalar una herramienta la resalta y dice su nombre; un clic la descuelga y la trae flotando
 * hacia quien mira (con un dato didáctico en el tooltip) y otro la cuelga. Arrastrar la herramienta tomada
 * la inspecciona: gira los destornilladores y los rollos, abre alicates y pinzas, arma el succionador y
 * desliza el calibrador, cuya pantalla marca los milímetros.
 */
export class ToolWallDevice implements WorkshopDevice {
  public readonly piece: ToolWallPiece;

  private readonly service = new ToolWallService();
  private readonly sound: ToolWallSound;
  private readonly unsubscribe: () => void;
  private active = false;

  /**
   * Crea el equipo.
   *
   * @param context Materiales, texturas, ubicación, audio y azar.
   */
  public constructor(context: WorkshopContext) {
    this.piece = new ToolWallPiece(context);
    this.sound = new ToolWallSound(context.audio);
    this.unsubscribe = this.service.subscribe((event) => {
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
    return this.active ? this.service.describe(id) : null;
  }

  /**
   * @inheritdoc
   */
  public press(id: string): void {
    if (this.active) {
      this.service.press(id);
    }
  }

  /**
   * @inheritdoc
   */
  public grab(id: string): ((pixels: number) => void) | null {
    if (!this.active || !this.service.grab(id)) {
      return null;
    }
    return (pixels: number): void => {
      this.service.inspect(pixels);
    };
  }

  /**
   * @inheritdoc
   */
  public highlight(id: string | null): void {
    this.piece.highlight(id);
  }

  /**
   * @inheritdoc
   */
  public setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.service.hangAll();
      this.piece.highlight(null);
    }
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Lleva un aviso del service a la escena y al sonido.
   *
   * @param event Aviso.
   */
  private onEvent(event: ToolWallEvent): void {
    const state = this.service.state;
    if (event.type === 'inspect') {
      this.piece.pose(state);
      return;
    }
    this.piece.hold(state);
    this.sound.clack(event.type === 'take');
  }
}
