import { FirmwareSound } from '../../audio/FirmwareSound';
import type { FirmwareEvent } from '../../models/FirmwareEvent';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { FirmwareService } from '../../services/FirmwareService';
import { FirmwareLabPiece } from './FirmwareLabPiece';
import { LaptopScreen } from './LaptopScreen';
import { FirmwareControl } from './firmware/FirmwareControl';

/**
 * Laboratorio de firmware en vivo como equipo del taller (Mediator entre la pieza 3D, el service y el
 * sonido): en la laptop se elige un programa y se sube a la ESP32, que lo corre de verdad en la matriz de
 * LEDs, el servo y el buzzer; el botón EN reinicia la placa y el potenciómetro, arrastrado, cambia la
 * velocidad. El buzzer solo suena con el taller en pantalla.
 */
export class FirmwareLabDevice implements WorkshopDevice {
  private static readonly SEED = 3208;
  private static readonly POT_PER_PIXEL = 12;
  private static readonly PULSE = { min: 0.5, span: 1.9, range: 180 };
  private static readonly DECIMALS = 2;
  private static readonly POT: string = FirmwareControl.Pot;

  public readonly piece: FirmwareLabPiece;

  private readonly service = new FirmwareService(FirmwareLabDevice.SEED);
  private readonly sound: FirmwareSound;
  private readonly unsubscribe: () => void;
  private readonly labels = new Map<string, () => string>([
    [FirmwareControl.Upload, (): string => this.uploadLabel()],
    [FirmwareControl.Reset, (): string => 'Botón EN · Reiniciar la placa (vuelve a setup)'],
    [FirmwareControl.Pot, (): string => this.potLabel()],
    [FirmwareControl.Buzzer, (): string => 'Buzzer · Probar tone(BUZZER, 880, 120)'],
    [FirmwareControl.Servo, (): string => this.servoLabel()],
    [FirmwareControl.Matrix, (): string => this.matrixLabel()],
  ]);
  private readonly actions = new Map<string, () => void>([
    [
      FirmwareControl.Upload,
      (): void => {
        this.service.startUpload();
      },
    ],
    [
      FirmwareControl.Reset,
      (): void => {
        this.service.reset();
      },
    ],
    [
      FirmwareControl.Buzzer,
      (): void => {
        this.service.beep();
      },
    ],
  ]);
  private active = false;

  /**
   * Crea el equipo.
   *
   * @param context Materiales, texturas, ubicación, audio y azar del taller.
   */
  public constructor(context: WorkshopContext) {
    this.piece = new FirmwareLabPiece(context, this.service);
    this.sound = new FirmwareSound(context.audio);
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
    const index = LaptopScreen.programIndex(id);
    const program = this.service.state.programs[index];
    if (program) {
      const open = index === this.service.state.selected;
      return open ? `${program.name} · Abierto en el editor` : `${program.name} · Abrir en el editor`;
    }
    return this.labels.get(id)?.() ?? null;
  }

  /**
   * @inheritdoc
   */
  public press(id: string): void {
    const index = LaptopScreen.programIndex(id);
    if (index >= 0) {
      this.service.select(index);
      return;
    }
    this.actions.get(id)?.();
  }

  /**
   * @inheritdoc
   */
  public grab(id: string): ((pixels: number) => void) | null {
    if (id !== FirmwareLabDevice.POT) {
      return null;
    }
    const start = this.service.state.pot;
    return (pixels: number): void => {
      this.service.setPot(start + pixels * FirmwareLabDevice.POT_PER_PIXEL);
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
    this.piece.setActive(active);
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
  }

  /**
   * Hace sonar los avisos del laboratorio (solo con el taller en pantalla).
   *
   * @param event Aviso.
   */
  private onEvent(event: FirmwareEvent): void {
    if (!this.active) {
      return;
    }
    if (event.type === 'tone') {
      this.sound.tone(event.hz, event.milliseconds);
    } else if (event.type === 'uploaded') {
      this.sound.chime();
    } else if (event.type === 'reset') {
      this.sound.click();
    }
  }

  /**
   * Tooltip del botón "Subir".
   *
   * @returns Texto.
   */
  private uploadLabel(): string {
    const state = this.service.state;
    if (this.service.uploading) {
      return `Subiendo · ${state.label}`;
    }
    const file = state.programs[state.selected]?.file ?? '';
    return `Subir ${file} a la ESP32 (compilar y flashear)`;
  }

  /**
   * Tooltip del potenciómetro.
   *
   * @returns Texto.
   */
  private potLabel(): string {
    const { pot, delay } = this.service.state;
    return `Potenciómetro · analogRead ${String(pot)}/4095 → delay ${String(delay)} ms · Arrastra`;
  }

  /**
   * Tooltip del servo.
   *
   * @returns Texto.
   */
  private servoLabel(): string {
    const angle = Math.round(this.piece.readings().servo);
    const { min, span, range } = FirmwareLabDevice.PULSE;
    const pulse = (min + (angle * span) / range).toFixed(FirmwareLabDevice.DECIMALS);
    return `Servo SG90 · ${String(angle)}° · pulso PWM ${pulse} ms`;
  }

  /**
   * Tooltip de la matriz.
   *
   * @returns Texto.
   */
  private matrixLabel(): string {
    const lit = this.piece.readings().lit;
    return `Matriz LED 8×8 (MAX7219 por SPI) · ${String(lit)} de 64 encendidos`;
  }
}
