import type { ScopeState } from '../models/ScopeState';

/**
 * Estado del osciloscopio de la barra (patrón Observer): encendido, RUN/STOP, disparo único, canales,
 * mediciones y escalas de la pantalla. Las teclas y perillas del equipo lo cambian y la pantalla, las luces
 * y las perillas lo reflejan.
 */
export class ScopeService {
  private static readonly TIMEBASES = [
    { seconds: 0.1 },
    { seconds: 0.2 },
    { seconds: 0.5 },
    { seconds: 1 },
    { seconds: 2 },
  ];
  private static readonly SCALES = [{ volts: 0.2 }, { volts: 0.5 }, { volts: 1 }, { volts: 2 }];
  private static readonly POSITION = { min: -3, max: 3, step: 0.1 };
  private static readonly DIVISIONS = { columns: 10, rows: 8 };
  private static readonly HEADROOM = 1.35;
  private static readonly DECIMALS = 2;
  private static readonly DEFAULTS: ScopeState = {
    powered: true,
    running: true,
    single: false,
    measurements: true,
    channels: [true, true],
    timebase: 2,
    scale: 1,
    position: 0,
  };

  private readonly listeners = new Set<() => void>();
  private current: ScopeState = ScopeService.DEFAULTS;

  /**
   * Estado actual.
   *
   * @returns Estado.
   */
  public get state(): ScopeState {
    return this.current;
  }

  /**
   * Base de tiempo actual.
   *
   * @returns Segundos por división.
   */
  public get timePerDivision(): number {
    return ScopeService.TIMEBASES[this.current.timebase]?.seconds ?? 1;
  }

  /**
   * Escala vertical actual.
   *
   * @returns Voltios por división.
   */
  public get voltsPerDivision(): number {
    return ScopeService.SCALES[this.current.scale]?.volts ?? 1;
  }

  /**
   * Cantidad de pasos de cada perilla de escala y rango de la posición, para girarlas a su lugar.
   *
   * @returns Pasos de base de tiempo y escala, y rango de la posición.
   */
  public get ranges(): {
    timebases: number;
    scales: number;
    position: { min: number; max: number; step: number };
  } {
    return {
      timebases: ScopeService.TIMEBASES.length,
      scales: ScopeService.SCALES.length,
      position: ScopeService.POSITION,
    };
  }

  /**
   * Divisiones de la retícula.
   *
   * @returns Columnas (tiempo) y filas (tensión).
   */
  public get divisions(): { columns: number; rows: number } {
    return ScopeService.DIVISIONS;
  }

  /**
   * Enciende o apaga el equipo. Al encender arranca adquiriendo.
   */
  public togglePower(): void {
    const powered = !this.current.powered;
    this.update({ powered, running: powered || this.current.running, single: false });
  }

  /**
   * Alterna entre adquirir (RUN) y congelar la traza (STOP).
   */
  public toggleRun(): void {
    this.update({ running: !this.current.running, single: false });
  }

  /**
   * Arma un disparo único: adquiere una vez y se detiene.
   */
  public single(): void {
    this.update({ running: true, single: true });
  }

  /**
   * Termina el disparo único (la pantalla ya capturó).
   */
  public finishSingle(): void {
    if (this.current.single) {
      this.update({ running: false, single: false });
    }
  }

  /**
   * AUTO: ajusta la base de tiempo para ver al menos un periodo, la escala para que la señal entre con
   * margen, centra las trazas, enciende ambos canales y vuelve a adquirir.
   *
   * @param period Periodo de la referencia (s).
   * @param peak Valor máximo esperado de la señal (V).
   */
  public auto(period: number, peak: number): void {
    const { columns, rows } = ScopeService.DIVISIONS;
    const timebase = ScopeService.firstIndex(
      ScopeService.TIMEBASES.map(({ seconds }) => seconds * columns >= period),
    );
    const room = peak * ScopeService.HEADROOM;
    const scale = ScopeService.firstIndex(ScopeService.SCALES.map(({ volts }) => volts * (rows / 2) >= room));
    this.update({ timebase, scale, position: 0, channels: [true, true], running: true, single: false });
  }

  /**
   * Muestra u oculta las mediciones automáticas.
   */
  public toggleMeasurements(): void {
    this.update({ measurements: !this.current.measurements });
  }

  /**
   * Muestra u oculta un canal.
   *
   * @param index Canal (0 = CH1, 1 = CH2).
   */
  public toggleChannel(index: number): void {
    this.update({
      channels: this.current.channels.map((visible, channel) => (channel === index ? !visible : visible)),
    });
  }

  /**
   * Fija la base de tiempo.
   *
   * @param index Índice pedido (se recorta al rango).
   */
  public setTimebase(index: number): void {
    this.update({ timebase: ScopeService.clampIndex(index, ScopeService.TIMEBASES.length) });
  }

  /**
   * Fija la escala vertical.
   *
   * @param index Índice pedido (se recorta al rango).
   */
  public setScale(index: number): void {
    this.update({ scale: ScopeService.clampIndex(index, ScopeService.SCALES.length) });
  }

  /**
   * Fija la posición vertical de las trazas.
   *
   * @param divisions Posición pedida (se ajusta a su rango y paso).
   */
  public setPosition(divisions: number): void {
    const { min, max, step } = ScopeService.POSITION;
    const snapped = Math.round(divisions / step) * step;
    this.update({ position: Number(Math.min(Math.max(snapped, min), max).toFixed(ScopeService.DECIMALS)) });
  }

  /**
   * Se suscribe a los cambios de estado.
   *
   * @param listener Se llama tras cada cambio.
   * @returns Función para cancelar la suscripción.
   */
  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Aplica cambios al estado y avisa.
   *
   * @param changes Campos nuevos.
   */
  private update(changes: Partial<ScopeState>): void {
    this.current = { ...this.current, ...changes };
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  /**
   * Primer índice que cumple una condición, o el último si ninguno la cumple.
   *
   * @param fits Si cada opción cumple.
   * @returns Índice.
   */
  private static firstIndex(fits: boolean[]): number {
    const index = fits.indexOf(true);
    return index < 0 ? fits.length - 1 : index;
  }

  /**
   * Recorta un índice a una lista.
   *
   * @param index Índice pedido.
   * @param length Largo de la lista.
   * @returns Índice válido.
   */
  private static clampIndex(index: number, length: number): number {
    return Math.min(Math.max(Math.round(index), 0), length - 1);
  }
}
