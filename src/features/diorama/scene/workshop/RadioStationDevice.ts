import { RadioSound } from '../../audio/RadioSound';
import { RadioControl } from '../../models/RadioControl';
import { RadioMode } from '../../models/RadioMode';
import type { RadioState } from '../../models/RadioState';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopDevice } from '../../models/WorkshopDevice';
import { RadioService } from '../../services/RadioService';
import { RadioStationPiece } from './RadioStationPiece';

/**
 * Estación de radio SDR del taller (RF + DSP): une la pieza 3D, el receptor simulado ({@link RadioService})
 * y el parlante. Arrastrar el dial sintoniza la banda de 40 m, arrastrar la antena la extiende (más SNR),
 * la tecla cambia AM / CW, el botón enciende, la pantalla busca la siguiente emisora y el parlante activa
 * el squelch. Los tooltips explican lo que pasa (banda, λ/4, BFO, tanque LC, morse decodificado).
 */
export class RadioStationDevice implements WorkshopDevice {
  private static readonly DRAG = { khzPerPixel: 0.5, antennaPerPixel: 0.004 };
  private static readonly KHZ_PER_MHZ = 1000;
  private static readonly QUARTER_WAVE = 10.6;
  private static readonly TOOLTIPS: Record<RadioControl, (state: RadioState) => string> = {
    [RadioControl.Power]: (state) => (state.on ? 'Receptor SDR · Apagar' : 'Receptor SDR · Encender'),
    [RadioControl.Dial]: (state) => RadioStationDevice.dial(state),
    [RadioControl.Antenna]: (state) => RadioStationDevice.antenna(state),
    [RadioControl.Mode]: (state) => RadioStationDevice.mode(state),
    [RadioControl.Screen]: (state) => RadioStationDevice.screen(state),
    [RadioControl.Board]: (state) => RadioStationDevice.board(state),
    [RadioControl.Speaker]: (state) =>
      state.squelch
        ? 'Parlante · Squelch activo: calla el ruido sin señal · Clic: quitarlo'
        : 'Parlante · Ruido blanco filtrado + tono de 700 Hz (Web Audio) · Clic: squelch',
  };

  public readonly piece: RadioStationPiece;

  private readonly service = new RadioService();
  private readonly sound: RadioSound;
  private readonly unsubscribe: () => void;

  /**
   * Crea la estación.
   *
   * @param context Materiales, texturas, ubicación y audio del taller.
   */
  public constructor(context: WorkshopContext) {
    this.sound = new RadioSound(context.audio);
    this.piece = new RadioStationPiece(context, this.service, this.sound);
    this.unsubscribe = this.service.on(() => {
      this.piece.refresh();
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
    const tooltip = RadioStationDevice.TOOLTIPS[id as RadioControl] as
      ((state: RadioState) => string) | undefined;
    return tooltip ? tooltip(this.service.state) : null;
  }

  /**
   * @inheritdoc
   */
  public press(id: string): void {
    const control = id as RadioControl;
    if (control === RadioControl.Power) {
      this.service.togglePower();
    } else if (control === RadioControl.Mode) {
      this.service.toggleMode();
    } else if (control === RadioControl.Screen) {
      this.service.scan();
    } else if (control === RadioControl.Speaker) {
      this.service.toggleSquelch();
    }
  }

  /**
   * @inheritdoc
   */
  public grab(id: string): ((pixels: number) => void) | null {
    const state = this.service.state;
    const { khzPerPixel, antennaPerPixel } = RadioStationDevice.DRAG;
    const control = id as RadioControl;
    if (control === RadioControl.Dial) {
      return (pixels: number): void => {
        this.service.tune(state.frequency + pixels * khzPerPixel);
      };
    }
    if (control === RadioControl.Antenna) {
      return (pixels: number): void => {
        this.service.extend(state.antenna + pixels * antennaPerPixel);
      };
    }
    return null;
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
    this.service.setActive(active);
  }

  /**
   * @inheritdoc
   */
  public dispose(): void {
    this.unsubscribe();
    this.sound.dispose();
  }

  /**
   * Tooltip del dial: banda, frecuencia, modo y emisora.
   *
   * @param state Estado.
   * @returns Texto.
   */
  private static dial(state: RadioState): string {
    const megahertz = (state.frequency / RadioStationDevice.KHZ_PER_MHZ).toFixed(3);
    const station = state.station ? ` · ${state.station.label}` : '';
    const lock = state.locked ? ' · AFC enganchado' : '';
    return `${RadioService.BAND.name} · ${megahertz} MHz · ${state.mode}${station}${lock} · Arrastra para sintonizar`;
  }

  /**
   * Tooltip de la antena: largo, SNR y la idea de λ/4.
   *
   * @param state Estado.
   * @returns Texto.
   */
  private static antenna(state: RadioState): string {
    const length = `Antena ${state.antennaLength.toFixed(2)} m`;
    const snr = state.station ? ` · SNR ${state.snr.toFixed(0)} dB` : '';
    const wave = String(RadioStationDevice.QUARTER_WAVE);
    return `${length}${snr} · La antena de λ/4 (${wave} m en 40 m) mejora la SNR · Arrastra para extenderla`;
  }

  /**
   * Tooltip de la tecla de modo.
   *
   * @param state Estado.
   * @returns Texto.
   */
  private static mode(state: RadioState): string {
    return state.mode === RadioMode.Cw
      ? 'Modo CW · el BFO bate con la portadora: tono de 700 Hz · Clic: AM'
      : 'Modo AM · detector de envolvente: se oye la modulación · Clic: CW';
  }

  /**
   * Tooltip de la pantalla: el morse que se decodifica o qué muestra.
   *
   * @param state Estado.
   * @returns Texto.
   */
  private static screen(state: RadioState): string {
    if (!state.on) {
      return 'SDR apagado · Enciende el receptor';
    }
    if (state.decoding && state.lastSymbol !== '') {
      return `Decodificando morse: ${state.lastSymbol} · Clic: buscar la siguiente estación`;
    }
    return 'Espectro (FFT) y cascada: el tiempo corre hacia abajo · Clic: buscar la siguiente estación';
  }

  /**
   * Tooltip de la placa de RF: el tanque LC resonando en la frecuencia sintonizada.
   *
   * @param state Estado.
   * @returns Texto.
   */
  private static board(state: RadioState): string {
    const megahertz = (state.frequency / RadioStationDevice.KHZ_PER_MHZ).toFixed(3);
    const capacitance = state.capacitance.toFixed(0);
    return `Placa de RF · Tanque LC: L 2.2 µH, C ${capacitance} pF → ${megahertz} MHz · f = 1/(2π√LC) · Cristal, bobinas y SMA`;
  }
}
