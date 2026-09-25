import type { TimelineDirectory } from '@shared/core/events/TimelineDirectory';
import type { PanelEvent } from '../models/PanelEvent';
import type { PanelState } from '../models/PanelState';

/**
 * Tablero del poste de la trayectoria (estado + Observer). Cada breaker es una etapa, en orden cronológico,
 * y el circuito es en serie: la corriente sale del MAIN y solo llega hasta el primer breaker abajo. La puerta
 * se abre con un clic (o sola al elegir una etapa en la vitrina) y, cerrada, solo responde ella. El MAIN
 * también manda sobre la farola del poste. Al salir de la sección la puerta se cierra, pero el MAIN se queda
 * como estaba: si el visitante apagó el poste, sigue apagado. Los controles se identifican con `door`, `main` o
 * `breaker-<índice>`.
 */
export class BreakerPanelService {
  public static readonly DOOR = 'door';
  public static readonly MAIN = 'main';

  private static readonly BREAKER = 'breaker-';
  private static readonly YEAR_MS = 31_557_600_000;

  private readonly listeners = new Set<(event: PanelEvent) => void>();
  private directory: TimelineDirectory = { breakers: [], seals: [], since: '' };
  private switches: boolean[] = [];
  private open = false;
  private main = true;
  private active = false;
  private selected = 0;

  /**
   * Estado actual del tablero.
   *
   * @returns Estado.
   */
  public get state(): PanelState {
    const { open, main, selected } = this;
    return { open, main, selected, breakers: [...this.switches], energized: this.energized() };
  }

  /**
   * Etiquetas de los breakers, sellos y fecha del medidor.
   *
   * @returns Datos de la trayectoria.
   */
  public get labels(): TimelineDirectory {
    return this.directory;
  }

  /**
   * Id del control del breaker de una etapa.
   *
   * @param index Índice de la etapa.
   * @returns Id del control.
   */
  public static breakerId(index: number): string {
    return `${BreakerPanelService.BREAKER}${String(index)}`;
  }

  /**
   * Años de experiencia que marca el medidor.
   *
   * @param now Fecha actual.
   * @returns Años (0 si no hay una fecha de inicio válida).
   */
  public years(now: Date): number {
    const start = Date.parse(this.directory.since);
    return Number.isNaN(start) ? 0 : Math.max(now.getTime() - start, 0) / BreakerPanelService.YEAR_MS;
  }

  /**
   * Fija las etapas del tablero (todas con su breaker abajo).
   *
   * @param directory Etiquetas, sellos y fecha del medidor.
   */
  public setDirectory(directory: TimelineDirectory): void {
    this.directory = directory;
    this.switches = directory.breakers.map(() => false);
    this.emit({ type: 'state' });
  }

  /**
   * Avisa si la sección de la trayectoria está abierta. Al salir, cierra la puerta; el MAIN queda como el
   * visitante lo dejó (si apagó el poste, sigue apagado).
   *
   * @param active Si está abierta.
   */
  public setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.setDoor(false);
    }
  }

  /**
   * Elige una etapa desde la vitrina: con la sección abierta, la puerta se abre para mostrar su breaker.
   *
   * @param index Índice de la etapa.
   */
  public select(index: number): void {
    this.selected = index;
    if (this.active) {
      this.setDoor(true);
    }
    this.emit({ type: 'state' });
  }

  /**
   * Texto del tooltip de un control, o `null` si ahora no hace nada (con la puerta cerrada solo responde
   * la puerta).
   *
   * @param control Control.
   * @returns Texto o `null`.
   */
  public describe(control: string): string | null {
    if (control === BreakerPanelService.DOOR) {
      return this.open ? 'Cerrar el tablero' : 'Abrir el tablero';
    }
    if (!this.open) {
      return null;
    }
    if (control === BreakerPanelService.MAIN) {
      return this.main ? 'MAIN · Cortar la corriente' : 'MAIN · Dar corriente';
    }
    const index = BreakerPanelService.indexOf(control);
    const label = this.directory.breakers[index];
    return label === undefined ? null : `${label} · ${this.switches[index] ? 'Bajar' : 'Subir'}`;
  }

  /**
   * Usa un control: la puerta se abre o se cierra y las palancas suben o bajan. Subir el breaker de una
   * etapa la elige en la vitrina.
   *
   * @param control Control.
   */
  public press(control: string): void {
    if (this.describe(control) === null) {
      return;
    }
    if (control === BreakerPanelService.DOOR) {
      this.setDoor(!this.open);
      return;
    }
    if (control === BreakerPanelService.MAIN) {
      this.main = !this.main;
      this.emit({ type: 'switch', on: this.main });
    } else {
      this.toggle(BreakerPanelService.indexOf(control));
    }
    this.emit({ type: 'state' });
  }

  /**
   * Suscribe un oyente a los avisos del tablero.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: PanelEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Sube o baja el breaker de una etapa; al subirlo, la elige.
   *
   * @param index Índice de la etapa.
   */
  private toggle(index: number): void {
    const on = !this.switches[index];
    this.switches[index] = on;
    this.emit({ type: 'switch', on });
    if (on) {
      this.selected = index;
      this.emit({ type: 'picked', index });
    }
  }

  /**
   * Abre o cierra la puerta (y avisa solo si cambió).
   *
   * @param open `true` para abrir.
   */
  private setDoor(open: boolean): void {
    if (open === this.open) {
      return;
    }
    this.open = open;
    this.emit({ type: 'door', open });
    this.emit({ type: 'state' });
  }

  /**
   * Etapas que reciben corriente: con el MAIN arriba, desde la primera hasta el primer breaker abajo.
   *
   * @returns Cantidad de etapas energizadas.
   */
  private energized(): number {
    if (!this.main) {
      return 0;
    }
    const firstOff = this.switches.indexOf(false);
    return firstOff === -1 ? this.switches.length : firstOff;
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: PanelEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Índice de etapa de un control `breaker-<índice>`.
   *
   * @param control Control.
   * @returns Índice, o -1 si no es un breaker.
   */
  private static indexOf(control: string): number {
    return control.startsWith(BreakerPanelService.BREAKER)
      ? Number(control.slice(BreakerPanelService.BREAKER.length))
      : -1;
  }
}
