import { OhmLabSound } from '../../audio/OhmLabSound';
import type { OhmLabEvent } from '../../models/OhmLabEvent';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { OhmLabService } from '../../services/OhmLabService';
import { OhmLabText } from '../../services/OhmLabText';
import { OhmLabPiece } from './OhmLabPiece';

/**
 * "Ley de Ohm en vivo" como equipo del taller (patrón Mediator): une el circuito ({@link OhmLabService}), su
 * pieza 3D y sus sonidos. Cada aviso del circuito se lleva a la escena (perillas, LED, panel, bandas de la
 * resistencia gigante) y al sonido (detenciones, interruptor, "pop" del LED). Solo responde con el taller en
 * pantalla.
 */
export class OhmLabDevice implements WorkshopDevice {
  public readonly piece: OhmLabPiece;

  private readonly service = new OhmLabService();
  private readonly text = new OhmLabText();
  private readonly sound: OhmLabSound;
  private readonly unsubscribe: () => void;
  private active = false;

  /**
   * Crea el equipo.
   *
   * @param context Materiales, texturas, ubicación, audio y azar del taller.
   */
  public constructor(context: WorkshopContext) {
    this.piece = new OhmLabPiece(context, this.service);
    this.sound = new OhmLabSound(context.audio);
    this.unsubscribe = this.service.on((event) => {
      this.handle(event);
    });
    this.refresh();
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
    return this.active ? this.service.grab(id) : null;
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
   * Lleva un aviso del circuito a la escena y al sonido.
   *
   * @param event Aviso.
   */
  private handle(event: OhmLabEvent): void {
    switch (event.type) {
      case 'state':
        this.refresh();
        break;
      case 'detent':
        this.sound.detent();
        break;
      case 'switch':
        this.sound.toggle(event.on);
        break;
      case 'burn':
        this.burn();
        break;
      case 'replace':
        this.renew();
        break;
    }
  }

  /**
   * El LED se quemó: destello, humo y "pop".
   */
  private burn(): void {
    this.piece.burst();
    this.sound.pop();
  }

  /**
   * Se puso un LED nuevo: el cajón se abre y suena el clic.
   */
  private renew(): void {
    this.piece.renew();
    this.sound.seat();
  }

  /**
   * Muestra el estado del circuito y el código de colores en la pieza.
   */
  private refresh(): void {
    const code = this.service.resistor;
    const value = this.text.ohms(code.ohms);
    this.piece.show(this.service.state, code, code.bands.length > 1 ? `${value} ±5%` : value);
  }
}
