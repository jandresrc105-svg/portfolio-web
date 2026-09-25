import { SeededRandom } from '@shared/core/math/SeededRandom';
import type { FirmwareEvent } from '../models/FirmwareEvent';
import { FirmwareLogKind } from '../models/FirmwareLogKind';
import type { FirmwareLogLine } from '../models/FirmwareLogLine';
import { FirmwarePhase } from '../models/FirmwarePhase';
import type { FirmwareProgram } from '../models/FirmwareProgram';
import type { FirmwareState } from '../models/FirmwareState';
import { BlinkProgram } from './firmware/BlinkProgram';
import { FirmwareMachine } from './firmware/FirmwareMachine';
import { FirmwareUploader } from './firmware/FirmwareUploader';
import { KnightRiderProgram } from './firmware/KnightRiderProgram';
import { LifeProgram } from './firmware/LifeProgram';
import { ScrollTextProgram } from './firmware/ScrollTextProgram';
import { ServoSweepProgram } from './firmware/ServoSweepProgram';
import { SnakeProgram } from './firmware/SnakeProgram';

/**
 * Laboratorio de firmware (estado + Observer): el IDE de la laptop con sus programas y la placa ESP32 que los
 * corre. Elegir un programa lo abre en el editor; "Subir" lo compila, lo escribe en la flash y reinicia la
 * placa, que desde ahí corre ese programa de verdad (`setup` una vez y `loop` con la pausa que fija el
 * potenciómetro). RESET reinicia el programa que ya está en la placa. Es la única fuente de verdad del
 * equipo; la escena y el sonido solo lo leen o escuchan sus avisos.
 */
export class FirmwareService {
  public static readonly ADC_MAX = FirmwareMachine.ADC_MAX;

  private static readonly LOG_LINES = 7;
  private static readonly MAX_LOOPS = 4;
  private static readonly MILLIS = 1000;
  private static readonly POT_REPORT = 0.35;
  private static readonly TEST_TONE = { hz: 880, milliseconds: 120 };
  private static readonly BOOT = [
    'ets Jun  8 2016 00:22:57',
    'rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)',
  ];

  private readonly listeners = new Set<(event: FirmwareEvent) => void>();
  private readonly programs: readonly FirmwareProgram[] = [
    new BlinkProgram(),
    new KnightRiderProgram(),
    new LifeProgram(),
    new SnakeProgram(),
    new ScrollTextProgram(),
    new ServoSweepProgram(),
  ];
  private readonly machine: FirmwareMachine;
  private readonly uploader = new FirmwareUploader();
  private log: FirmwareLogLine[] = [];
  private selected = 0;
  private running = 0;
  private upload: { elapsed: number; program: number; text: string } | null = null;
  private clock = 0;
  private buzzing = { hz: 0, left: 0 };
  private potTimer = 0;
  private potDirty = false;
  private revision = 0;

  /**
   * Crea el laboratorio con el primer programa ya subido y corriendo.
   *
   * @param seed Semilla del azar de los programas (`random`).
   */
  public constructor(seed: number) {
    this.machine = new FirmwareMachine(new SeededRandom(seed));
    this.boot(0);
  }

  /**
   * Estado actual.
   *
   * @returns Estado.
   */
  public get state(): FirmwareState {
    return {
      programs: this.programs,
      selected: this.selected,
      running: this.running,
      ...this.progress(),
      log: this.log,
      matrix: this.machine.matrix,
      builtin: this.machine.led,
      servo: this.machine.angle,
      buzzer: this.buzzing.left > 0 ? this.buzzing.hz : 0,
      pot: this.machine.pot,
      delay: this.delay(),
      traffic: this.machine.traffic,
      revision: this.revision,
    };
  }

  /**
   * Indica si hay una subida en curso.
   *
   * @returns `true` mientras compila o escribe la flash.
   */
  public get uploading(): boolean {
    return this.upload !== null;
  }

  /**
   * Avanza el tiempo: la subida en curso o las vueltas de `loop` del programa.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public advance(delta: number): void {
    if (this.upload) {
      this.flash(delta);
    } else {
      this.run(delta);
    }
    this.buzzing.left = Math.max(this.buzzing.left - delta, 0);
    this.reportPot(delta);
    this.flush();
  }

  /**
   * Abre un programa en el editor (no cambia lo que corre en la placa hasta subirlo).
   *
   * @param index Programa.
   */
  public select(index: number): void {
    if (index !== this.selected && this.programs[index]) {
      this.selected = index;
      this.touch();
    }
  }

  /**
   * Compila y sube el programa abierto en el editor.
   */
  public startUpload(): void {
    if (this.upload) {
      return;
    }
    this.upload = { elapsed: 0, program: this.selected, text: '' };
    this.machine.reset();
    this.log = [];
    this.touch();
    this.emit({ type: 'upload' });
  }

  /**
   * Reinicia la placa (botón EN): el programa vuelve a empezar desde `setup`.
   */
  public reset(): void {
    if (this.upload) {
      return;
    }
    this.boot(this.running);
    this.emit({ type: 'reset' });
  }

  /**
   * Fija la lectura del potenciómetro.
   *
   * @param value Lectura deseada (se recorta a 0–4095).
   */
  public setPot(value: number): void {
    const pot = Math.round(Math.min(Math.max(value, 0), FirmwareService.ADC_MAX));
    if (pot !== this.machine.pot) {
      this.machine.pot = pot;
      this.potDirty = true;
      this.touch();
    }
  }

  /**
   * Prueba el buzzer con un pitido fijo.
   */
  public beep(): void {
    const { hz, milliseconds } = FirmwareService.TEST_TONE;
    this.machine.tone(hz, milliseconds);
    this.write(`tone(BUZZER, ${String(hz)}, ${String(milliseconds)})`, FirmwareLogKind.Input);
  }

  /**
   * Suscribe un oyente a los avisos.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: FirmwareEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Corre las vueltas de `loop` que tocan según la pausa actual.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private run(delta: number): void {
    const program = this.programs[this.running];
    const pause = this.delay();
    this.clock += delta * FirmwareService.MILLIS;
    for (let loops = 0; program && this.clock >= pause && loops < FirmwareService.MAX_LOOPS; loops++) {
      this.clock -= pause;
      program.loop(this.machine);
    }
    this.clock = Math.min(this.clock, pause);
  }

  /**
   * Avanza la subida en curso y, al terminar, reinicia la placa con el programa nuevo.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private flash(delta: number): void {
    const upload = this.upload;
    const status = this.uploadStatus();
    if (!upload || !status) {
      return;
    }
    upload.elapsed += delta;
    if (status.phase === FirmwarePhase.Flashing) {
      this.machine.traffic += 1;
    }
    this.showBuild(status.lines);
    if (status.done) {
      this.upload = null;
      this.boot(upload.program);
      this.emit({ type: 'uploaded' });
    }
  }

  /**
   * Muestra en la consola la salida de la compilación y de esptool (solo si cambió).
   *
   * @param lines Líneas de la subida.
   */
  private showBuild(lines: readonly string[]): void {
    const text = lines.join('\n');
    if (this.upload && text !== this.upload.text) {
      this.upload.text = text;
      this.log = lines.map((line) => ({ text: line, kind: FirmwareLogKind.Build }));
      this.touch();
    }
  }

  /**
   * Etapa, avance y texto de la barra de estado.
   *
   * @returns Etapa, avance y texto.
   */
  private progress(): { phase: FirmwarePhase; progress: number; label: string } {
    const upload = this.uploadStatus();
    if (upload) {
      return { phase: upload.phase, progress: upload.progress, label: upload.label };
    }
    const file = this.programs[this.running]?.file ?? '';
    return { phase: FirmwarePhase.Running, progress: 0, label: `Ejecutando ${file}` };
  }

  /**
   * Cómo va la subida en curso.
   *
   * @returns Estado de la subida o `null` si no hay.
   */
  private uploadStatus(): ReturnType<FirmwareUploader['at']> | null {
    const program = this.upload ? this.programs[this.upload.program] : undefined;
    return this.upload && program ? this.uploader.at(this.upload.elapsed, program) : null;
  }

  /**
   * Arranca la placa con un programa: mensajes del cargador, `setup` y la primera vuelta de inmediato.
   *
   * @param index Programa.
   */
  private boot(index: number): void {
    this.running = index;
    this.machine.reset();
    FirmwareService.BOOT.forEach((line) => {
      this.write(line, FirmwareLogKind.Boot);
    });
    const program = this.programs[index];
    this.write(`» ${program?.file ?? ''} · setup()`, FirmwareLogKind.Boot);
    program?.setup(this.machine);
    this.clock = this.delay();
  }

  /**
   * Pausa de `loop` según el potenciómetro: `map(analogRead(POT), 0, 4095, lento, rápido)`.
   *
   * @returns Milisegundos.
   */
  private delay(): number {
    const program = this.programs[this.running];
    if (!program) {
      return FirmwareService.MILLIS;
    }
    const { slow, fast } = program.delay;
    return Math.trunc(slow + ((fast - slow) * this.machine.pot) / FirmwareService.ADC_MAX);
  }

  /**
   * Muestra la lectura del potenciómetro en el monitor, a lo sumo unas veces por segundo.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private reportPot(delta: number): void {
    this.potTimer = Math.max(this.potTimer - delta, 0);
    if (!this.potDirty || this.potTimer > 0) {
      return;
    }
    this.potDirty = false;
    this.potTimer = FirmwareService.POT_REPORT;
    const reading = `analogRead(POT) = ${String(this.machine.pot)} → delay ${String(this.delay())} ms`;
    this.write(reading, FirmwareLogKind.Input);
  }

  /**
   * Pasa a la consola lo que el programa escribió y avisa los pitidos del buzzer.
   */
  private flush(): void {
    this.machine.takeLines().forEach((line) => {
      this.write(line, FirmwareLogKind.Serial);
    });
    this.machine.takeTones().forEach(({ hz, milliseconds }) => {
      this.buzzing = { hz, left: milliseconds / FirmwareService.MILLIS };
      this.emit({ type: 'tone', hz, milliseconds });
    });
  }

  /**
   * Agrega una línea a la consola (conserva solo las últimas).
   *
   * @param text Texto.
   * @param kind Origen.
   */
  private write(text: string, kind: FirmwareLogKind): void {
    this.log = [...this.log, { text, kind }].slice(-FirmwareService.LOG_LINES);
    this.touch();
  }

  /**
   * Marca que cambió algo que muestra la pantalla.
   */
  private touch(): void {
    this.revision += 1;
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: FirmwareEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
