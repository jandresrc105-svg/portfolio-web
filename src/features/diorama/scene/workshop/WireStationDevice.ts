import { WireSound } from '../../audio/WireSound';
import type { WireEvent } from '../../models/WireEvent';
import { WireStep } from '../../models/WireStep';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { WireStationService } from '../../services/WireStationService';
import { WireStationPiece } from './WireStationPiece';

/**
 * Estación de cableado como equipo del taller (Facade + Mediator): une la máquina de estados
 * ({@link WireStationService}), la pieza 3D y los sonidos. El carrete corta, el pelacables y la punta se
 * arrastran, el cautín estaña, la bornera conecta y el botón del panel reinicia. Solo responde con el taller en
 * pantalla.
 */
export class WireStationDevice implements WorkshopDevice {
  public readonly piece: WireStationPiece;

  private readonly service = new WireStationService();
  private readonly sound: WireSound;
  private readonly unsubscribe: () => void;
  private readonly cues: Partial<Record<WireStep, () => void>> = {
    [WireStep.Pulling]: (): void => {
      this.sound.rustle(WireStationService.PULL.duration);
    },
    [WireStep.Cut]: (): void => {
      this.sound.snip();
    },
    [WireStep.Stripped]: (): void => {
      this.sound.pop();
    },
    [WireStep.Tinning]: (): void => {
      const { touch, release, duration } = WireStationService.TIN;
      this.sound.sizzle(touch * duration, (release - touch) * duration);
    },
    [WireStep.Connecting]: (): void => {
      const { slide, screw, duration } = WireStationService.CONNECT;
      this.sound.ratchet(slide * duration, (screw - slide) * duration);
    },
    [WireStep.Connected]: (): void => {
      this.sound.chime();
    },
  };
  private active = false;

  /**
   * Crea la estación.
   *
   * @param context Materiales, texturas, ubicación, audio y azar del taller.
   */
  public constructor(context: WorkshopContext) {
    this.piece = new WireStationPiece(context, this.service);
    this.sound = new WireSound(context.audio);
    this.unsubscribe = this.service.on((event) => {
      this.play(event);
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
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Suena cada paso: el roce del cable y el corte, el aislante que sale, el estaño y el tornillo.
   *
   * @param event Aviso de la estación.
   */
  private play(event: WireEvent): void {
    if (event.type === 'ruined') {
      this.sound.snip();
      this.sound.buzz();
      return;
    }
    if (event.type === 'step') {
      this.playStep(event.step);
    }
  }

  /**
   * Sonido del comienzo de un paso.
   *
   * @param step Paso que empieza.
   */
  private playStep(step: WireStep): void {
    this.cues[step]?.();
  }
}
