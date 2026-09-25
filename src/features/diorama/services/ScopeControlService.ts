import type { GainLimits } from '@shared/control/GainLimits';
import type { PidLoopService } from '@shared/control/PidLoopService';
import type { ScopeControlId } from '../models/ScopeControlId';
import type { ScopeDial } from '../models/ScopeDial';
import type { ScopeService } from './ScopeService';

/**
 * Tablero del osciloscopio (patrón Facade + Command): traduce cada tecla y perilla en una acción sobre el
 * lazo PID (ganancias y generador de la referencia) o sobre el estado del equipo (encendido, RUN/STOP,
 * canales y escalas). También dice cómo se ve cada control: cuánto está girada una perilla, si una tecla
 * está iluminada y qué texto mostrar al señalarlo. Con el equipo apagado solo responde la tecla de encendido.
 */
export class ScopeControlService {
  private static readonly KNOB_TRAVEL = 240;
  private static readonly STEP_PIXELS = 36;
  private static readonly DRAG_HINT = ' · arrastra ↕';
  private static readonly MILLI = 1000;
  private static readonly PERCENT = 100;

  private readonly actions: Readonly<Partial<Record<ScopeControlId, () => void>>>;
  private readonly dials: Readonly<Partial<Record<ScopeControlId, ScopeDial>>>;

  /**
   * Crea el tablero.
   *
   * @param pid Lazo PID (ganancias y referencia).
   * @param scope Estado del osciloscopio.
   */
  public constructor(
    private readonly pid: PidLoopService,
    private readonly scope: ScopeService,
  ) {
    this.dials = { ...this.gainDials(), ...this.generatorDials(), ...this.displayDials() };
    this.actions = this.buttonActions();
  }

  /**
   * Lazo PID que muestra el osciloscopio.
   *
   * @returns Lazo.
   */
  public get loop(): PidLoopService {
    return this.pid;
  }

  /**
   * Estado del osciloscopio.
   *
   * @returns Servicio del estado.
   */
  public get settings(): ScopeService {
    return this.scope;
  }

  /**
   * Indica si un control es una perilla (se arrastra) o una tecla (se pulsa).
   *
   * @param id Control.
   * @returns `true` si es una perilla.
   */
  public isKnob(id: ScopeControlId): boolean {
    return this.dials[id] !== undefined;
  }

  /**
   * Indica si el control responde ahora (con el equipo apagado solo responde el encendido).
   *
   * @param id Control.
   * @returns `true` si está disponible.
   */
  public available(id: ScopeControlId): boolean {
    return id === 'power' || this.scope.state.powered;
  }

  /**
   * Pulsa una tecla.
   *
   * @param id Tecla.
   */
  public press(id: ScopeControlId): void {
    if (!this.available(id) || this.isKnob(id)) {
      return;
    }
    this.actions[id]?.();
  }

  /**
   * Toma una perilla para girarla.
   *
   * @param id Perilla.
   * @returns Función que aplica el giro según los píxeles arrastrados desde que se tomó (positivo = hacia
   * arriba), o `null` si no es una perilla disponible.
   */
  public grab(id: ScopeControlId): ((pixels: number) => void) | null {
    const dial = this.dials[id];
    if (!dial || !this.available(id)) {
      return null;
    }
    const start = dial.read();
    const { min, max, step } = dial.limits();
    const perPixel =
      step >= 1 ? step / ScopeControlService.STEP_PIXELS : (max - min) / ScopeControlService.KNOB_TRAVEL;
    return (pixels: number): void => {
      dial.write(start + pixels * perPixel);
    };
  }

  /**
   * Cuánto está girada una perilla.
   *
   * @param id Perilla.
   * @returns Posición [0, 1] entre sus topes.
   */
  public fraction(id: ScopeControlId): number {
    const dial = this.dials[id];
    if (!dial) {
      return 0;
    }
    const { min, max } = dial.limits();
    return (dial.read() - min) / (max - min);
  }

  /**
   * Luz de una tecla.
   *
   * @param id Tecla.
   * @returns `on` iluminada, `alert` en rojo (STOP, o el encendido en reposo) u `off`.
   */
  public lamp(id: ScopeControlId): 'on' | 'alert' | 'off' {
    const { powered, running } = this.scope.state;
    if (id === 'power') {
      return powered ? 'on' : 'alert';
    }
    if (!powered) {
      return 'off';
    }
    if (id === 'run') {
      return running ? 'on' : 'alert';
    }
    return this.lit(id) ? 'on' : 'off';
  }

  /**
   * Texto del tooltip de un control.
   *
   * @param id Control.
   * @returns Texto.
   */
  public describe(id: ScopeControlId): string {
    const dial = this.dials[id];
    if (dial) {
      return `${dial.text(dial.read())}${ScopeControlService.DRAG_HINT}`;
    }
    return this.buttonText(id);
  }

  /**
   * Se suscribe a cualquier cambio del lazo o del equipo.
   *
   * @param listener Se llama tras cada cambio.
   * @returns Función para cancelar ambas suscripciones.
   */
  public onChange(listener: () => void): () => void {
    const stopLoop = this.pid.onChange(listener);
    const stopScope = this.scope.onChange(listener);
    return (): void => {
      stopLoop();
      stopScope();
    };
  }

  /**
   * Si una tecla de estado está iluminada: SINGLE armado, mediciones visibles o canal visible.
   *
   * @param id Tecla.
   * @returns `true` si está encendida.
   */
  private lit(id: ScopeControlId): boolean {
    const { single, measurements, channels } = this.scope.state;
    const lamps: Partial<Record<ScopeControlId, boolean | undefined>> = {
      single,
      menu: measurements,
      ch1: channels[0],
      ch2: channels[1],
    };
    return lamps[id] === true;
  }

  /**
   * Texto de una tecla según el estado actual.
   *
   * @param id Tecla.
   * @returns Texto.
   */
  private buttonText(id: ScopeControlId): string {
    const { powered, running, measurements, channels } = this.scope.state;
    const show = (visible: boolean | undefined): string => (visible === true ? 'ocultar' : 'mostrar');
    const texts: Partial<Record<ScopeControlId, string>> = {
      power: powered ? 'Apagar el osciloscopio' : 'Encender el osciloscopio',
      run: running ? 'RUN/STOP · congelar la traza' : 'RUN/STOP · reanudar',
      single: 'SINGLE · captura única',
      auto: 'AUTO · autoajustar escalas',
      menu: `MENU · ${measurements ? 'ocultar' : 'mostrar'} mediciones`,
      ch1: `CH1 y(t) · ${show(channels[0])}`,
      ch2: `CH2 r(t) · ${show(channels[1])}`,
    };
    return texts[id] ?? '';
  }

  /**
   * Acción de cada tecla.
   *
   * @returns Acciones por tecla.
   */
  private buttonActions(): Partial<Record<ScopeControlId, () => void>> {
    const { scope } = this;
    return {
      ...this.acquisitionActions(),
      menu: (): void => {
        scope.toggleMeasurements();
      },
      ch1: (): void => {
        scope.toggleChannel(0);
      },
      ch2: (): void => {
        scope.toggleChannel(1);
      },
    };
  }

  /**
   * Acciones de encendido y adquisición: POWER, RUN/STOP, SINGLE y AUTO.
   *
   * @returns Acciones por tecla.
   */
  private acquisitionActions(): Partial<Record<ScopeControlId, () => void>> {
    const { scope } = this;
    return {
      power: (): void => {
        scope.togglePower();
      },
      run: (): void => {
        scope.toggleRun();
      },
      single: (): void => {
        scope.single();
      },
      auto: (): void => {
        this.autoset();
      },
    };
  }

  /**
   * AUTO: ajusta las escalas al periodo y al pico esperado de la señal (referencia más sobrepico).
   */
  private autoset(): void {
    const { period, signal, metrics } = this.pid;
    this.scope.auto(period, signal.amplitude * (1 + (2 * metrics.overshoot) / ScopeControlService.PERCENT));
  }

  /**
   * Perillas de las ganancias del PID.
   *
   * @returns Perillas Kp, Ki y Kd.
   */
  private gainDials(): Partial<Record<ScopeControlId, ScopeDial>> {
    const gain = (key: 'kp' | 'ki' | 'kd', name: string, decimals: number): ScopeDial => ({
      read: (): number => this.pid.gains[key],
      limits: (): GainLimits => this.pid.limits[key],
      write: (value: number): void => {
        this.pid.tune({ [key]: value });
      },
      text: (value: number): string => `${name} ${value.toFixed(decimals)}`,
    });
    return { kp: gain('kp', 'Kp', 1), ki: gain('ki', 'Ki', 1), kd: gain('kd', 'Kd', 2) };
  }

  /**
   * Perillas del generador de la referencia (amplitud y frecuencia de la onda cuadrada).
   *
   * @returns Perillas AMPL y FREQ.
   */
  private generatorDials(): Partial<Record<ScopeControlId, ScopeDial>> {
    const setting = (key: 'amplitude' | 'frequency', name: string, unit: string): ScopeDial => ({
      read: (): number => this.pid.signal[key],
      limits: (): GainLimits => this.pid.signalLimits[key],
      write: (value: number): void => {
        this.pid.setSignal({ [key]: value });
      },
      text: (value: number): string => `${name} ${value.toFixed(2)} ${unit}`,
    });
    return {
      amplitude: setting('amplitude', 'Amplitud', 'V'),
      frequency: setting('frequency', 'Frecuencia', 'Hz'),
    };
  }

  /**
   * Perillas de la pantalla: base de tiempo, escala vertical y posición.
   *
   * @returns Perillas TIME/DIV, SCALE y POSITION.
   */
  private displayDials(): Partial<Record<ScopeControlId, ScopeDial>> {
    const { scope } = this;
    const { timebases, scales, position } = scope.ranges;
    const timebase = ScopeControlService.stepped(timebases, {
      read: (): number => scope.state.timebase,
      write: (value: number): void => {
        scope.setTimebase(value);
      },
      text: (): string => `Tiempo ${ScopeControlService.units(scope.timePerDivision, 's')}/div`,
    });
    const scale = ScopeControlService.stepped(scales, {
      read: (): number => scope.state.scale,
      write: (value: number): void => {
        scope.setScale(value);
      },
      text: (): string => `Escala ${ScopeControlService.units(scope.voltsPerDivision, 'V')}/div`,
    });
    return { timebase, scale, position: this.positionDial(position) };
  }

  /**
   * Perilla de posición vertical.
   *
   * @param limits Rango y paso de la posición.
   * @returns Perilla.
   */
  private positionDial(limits: GainLimits): ScopeDial {
    return {
      read: (): number => this.scope.state.position,
      limits: (): GainLimits => limits,
      write: (value: number): void => {
        this.scope.setPosition(value);
      },
      text: (value: number): string => `Posición ${value >= 0 ? '+' : ''}${value.toFixed(1)} div`,
    };
  }

  /**
   * Perilla con posiciones fijas (una por opción).
   *
   * @param count Cantidad de posiciones.
   * @param dial Lectura, escritura y texto.
   * @returns Perilla completa.
   */
  private static stepped(count: number, dial: Omit<ScopeDial, 'limits'>): ScopeDial {
    return { ...dial, limits: (): GainLimits => ({ min: 0, max: count - 1, step: 1 }) };
  }

  /**
   * Valor con prefijo mili si es menor que 1 (500 mV, 200 ms, 1 s).
   *
   * @param value Valor en la unidad base.
   * @param unit Unidad.
   * @returns Texto.
   */
  private static units(value: number, unit: string): string {
    return value < 1
      ? `${String(Math.round(value * ScopeControlService.MILLI))} m${unit}`
      : `${String(value)} ${unit}`;
  }
}
