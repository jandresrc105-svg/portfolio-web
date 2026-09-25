import type { BenchEvent } from '../models/BenchEvent';
import type { BenchState } from '../models/BenchState';

/**
 * Banco de pruebas del taller de electrónica (estado + Observer). Cada placa colgada en el tablero perforado
 * es un proyecto; la elegida baja al banco y la fuente de laboratorio la alimenta. La fuente y la lámpara de
 * lupa se prenden y apagan con un clic. Los controles se identifican con `supply`, `lamp` o
 * `board-<índice>`.
 */
export class WorkbenchService {
  public static readonly SUPPLY = 'supply';
  public static readonly LAMP = 'lamp';

  private static readonly BOARD = 'board-';
  private static readonly VOLTS = 5;
  private static readonly DRAW = [{ amps: 0.182 }, { amps: 0.246 }, { amps: 0.131 }, { amps: 0.318 }];

  private readonly listeners = new Set<(event: BenchEvent) => void>();
  private boards: readonly string[] = [];
  private selected = 0;
  private supply = true;
  private lamp = true;

  /**
   * Estado actual del banco.
   *
   * @returns Estado.
   */
  public get state(): BenchState {
    const { boards, selected, supply, lamp } = this;
    const powered = supply && boards.length > 0;
    const draw = WorkbenchService.DRAW[selected % WorkbenchService.DRAW.length]?.amps ?? 0;
    return {
      boards,
      selected,
      supply,
      lamp,
      volts: supply ? WorkbenchService.VOLTS : 0,
      amps: powered ? draw : 0,
    };
  }

  /**
   * Id del control de una placa.
   *
   * @param index Índice de la placa.
   * @returns Id del control.
   */
  public static boardId(index: number): string {
    return `${WorkbenchService.BOARD}${String(index)}`;
  }

  /**
   * Fija las placas del tablero (una por proyecto); la primera queda en el banco.
   *
   * @param boards Etiqueta de cada placa.
   */
  public setBoards(boards: readonly string[]): void {
    this.boards = boards;
    this.selected = 0;
    this.emit({ type: 'state' });
  }

  /**
   * Lleva una placa al banco desde la vitrina.
   *
   * @param index Índice de la placa.
   */
  public select(index: number): void {
    if (index === this.selected || this.boards[index] === undefined) {
      return;
    }
    this.selected = index;
    this.emit({ type: 'state' });
  }

  /**
   * Texto del tooltip de un control, o `null` si no es un control del banco.
   *
   * @param control Control.
   * @returns Texto o `null`.
   */
  public describe(control: string): string | null {
    if (control === WorkbenchService.SUPPLY) {
      return this.supply ? 'Fuente · Apagar' : 'Fuente · Encender';
    }
    if (control === WorkbenchService.LAMP) {
      return this.lamp ? 'Lupa · Apagar la luz' : 'Lupa · Encender la luz';
    }
    const index = WorkbenchService.indexOf(control);
    const label = this.boards[index];
    if (label === undefined) {
      return null;
    }
    return index === this.selected ? `${label} · En el banco` : `${label} · Probar en el banco`;
  }

  /**
   * Usa un control: la fuente y la lámpara se prenden o apagan, y una placa baja al banco (y se elige en la
   * vitrina).
   *
   * @param control Control.
   */
  public press(control: string): void {
    if (control === WorkbenchService.SUPPLY) {
      this.supply = !this.supply;
      this.emit({ type: 'switch', on: this.supply });
    } else if (control === WorkbenchService.LAMP) {
      this.lamp = !this.lamp;
      this.emit({ type: 'switch', on: this.lamp });
    } else {
      this.pick(WorkbenchService.indexOf(control));
      return;
    }
    this.emit({ type: 'state' });
  }

  /**
   * Suscribe un oyente a los avisos del banco.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: BenchEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Lleva al banco la placa tocada en la escena y avisa a la vitrina.
   *
   * @param index Índice de la placa.
   */
  private pick(index: number): void {
    if (this.boards[index] === undefined || index === this.selected) {
      return;
    }
    this.selected = index;
    this.emit({ type: 'picked', index });
    this.emit({ type: 'state' });
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: BenchEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Índice de placa de un control `board-<índice>`.
   *
   * @param control Control.
   * @returns Índice, o -1 si no es una placa.
   */
  private static indexOf(control: string): number {
    return control.startsWith(WorkbenchService.BOARD)
      ? Number(control.slice(WorkbenchService.BOARD.length))
      : -1;
  }
}
