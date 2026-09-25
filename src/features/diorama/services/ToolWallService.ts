import { ToolId } from '../models/ToolId';
import type { ToolInfo } from '../models/ToolInfo';
import type { ToolWallEvent } from '../models/ToolWallEvent';
import type { ToolWallState } from '../models/ToolWallState';

/**
 * Pared de herramientas del taller (estado + Observer). Cada herramienta cuelga de su gancho; un clic la toma
 * (y devuelve la que estuviera tomada) y otro la cuelga. Arrastrar la herramienta tomada la inspecciona: gira
 * y abre o cierra su mecanismo (mordazas, émbolo, corredera del calibrador). Es la única fuente de verdad de
 * la pared: la escena y el sonido solo escuchan sus avisos.
 */
export class ToolWallService {
  private static readonly TOOLS: readonly ToolInfo[] = [
    {
      id: ToolId.Caliper,
      name: 'Calibrador digital',
      tip: 'mide patas, tornillos y el grosor de una placa (1,6 mm la estándar)',
      measures: true,
    },
    {
      id: ToolId.Cutter,
      name: 'Alicate de corte',
      tip: 'corta al ras las patas de los componentes ya soldados',
    },
    {
      id: ToolId.NeedleNose,
      name: 'Pinza de puntas',
      tip: 'dobla las patas de las resistencias a la medida de la placa',
    },
    { id: ToolId.Stripper, name: 'Pelacables', tip: 'la muesca 22 AWG es la del cable de protoboard' },
    { id: ToolId.Crimper, name: 'Crimpadora', tip: 'cierra terminales Dupont y JST sin soldar' },
    { id: ToolId.Tweezers, name: 'Pinza de electrónica', tip: 'ubica los SMD 0805 antes de soldarlos' },
    { id: ToolId.FlatDriver, name: 'Destornillador plano', tip: 'para borneras de tornillo y trimmers' },
    {
      id: ToolId.CrossDriver,
      name: 'Destornillador de estrella',
      tip: 'PH1 para carcasas: la punta justa no barre la cabeza',
    },
    {
      id: ToolId.PrecisionDriver,
      name: 'Destornillador de precisión',
      tip: 'el capuchón gira libre: se empuja con el dedo',
    },
    { id: ToolId.Solder, name: 'Estaño 63/37', tip: 'con núcleo de flux, funde a 183 °C' },
    { id: ToolId.Tape, name: 'Cinta aislante', tip: 'aísla empalmes; en placas, mejor termorretráctil' },
    {
      id: ToolId.DesolderPump,
      name: 'Succionador de estaño',
      tip: 'arma el émbolo, funde la unión y dispara sobre ella',
    },
  ];
  private static readonly CATALOG = new Map<string, ToolInfo>(
    ToolWallService.TOOLS.map((tool) => [tool.id, tool]),
  );
  private static readonly DRAG = { turn: 0.022, open: 0.006 };
  private static readonly CALIPER = { range: 150, decimals: 2 };

  private readonly listeners = new Set<(event: ToolWallEvent) => void>();
  private held: ToolId | null = null;
  private turn = 0;
  private open = 0;
  private start = { turn: 0, open: 0 };

  /**
   * Estado actual de la pared.
   *
   * @returns Estado.
   */
  public get state(): ToolWallState {
    return { held: this.held, turn: this.turn, open: this.open, reading: this.millimeters };
  }

  /**
   * Lectura del calibrador según la apertura de su corredera.
   *
   * @returns Milímetros.
   */
  public get millimeters(): number {
    return this.held === ToolId.Caliper ? this.open * ToolWallService.CALIPER.range : 0;
  }

  /**
   * Lectura del calibrador con dos decimales y coma decimal.
   *
   * @param millimeters Milímetros.
   * @returns Texto de la lectura.
   */
  public static reading(millimeters: number): string {
    return millimeters.toFixed(ToolWallService.CALIPER.decimals).replace('.', ',');
  }

  /**
   * Herramientas de la pared, en su orden.
   *
   * @returns Fichas.
   */
  public tools(): readonly ToolInfo[] {
    return ToolWallService.TOOLS;
  }

  /**
   * Texto del tooltip de una herramienta: su nombre colgada; su nombre y un dato didáctico tomada.
   *
   * @param id Control.
   * @returns Texto o `null` si no es una herramienta.
   */
  public describe(id: string): string | null {
    const info = ToolWallService.CATALOG.get(id);
    if (!info) {
      return null;
    }
    if (info.id !== this.held) {
      return `${info.name} · Tomar`;
    }
    const reading = info.measures ? `${ToolWallService.reading(this.millimeters)} mm · ` : '';
    return `${info.name} · ${reading}${info.tip}`;
  }

  /**
   * Toma una herramienta (devolviendo la anterior) o cuelga la que ya está tomada.
   *
   * @param id Control.
   */
  public press(id: string): void {
    const info = ToolWallService.CATALOG.get(id);
    if (!info) {
      return;
    }
    const previous = this.hangAll();
    if (previous !== info.id) {
      this.held = info.id;
      this.turn = 0;
      this.open = 0;
      this.emit({ type: 'take', tool: info.id });
    }
  }

  /**
   * Empieza a inspeccionar la herramienta tomada (solo si es la señalada).
   *
   * @param id Control.
   * @returns `true` si se puede arrastrar.
   */
  public grab(id: string): boolean {
    const info = ToolWallService.CATALOG.get(id);
    if (this.held === null || info?.id !== this.held) {
      return false;
    }
    this.start = { turn: this.turn, open: this.open };
    return true;
  }

  /**
   * Inspecciona la herramienta tomada: el arrastre hacia arriba la gira y abre su mecanismo.
   *
   * @param pixels Desplazamiento vertical desde que se tomó (positivo = hacia arriba).
   */
  public inspect(pixels: number): void {
    if (this.held === null) {
      return;
    }
    const { turn, open } = ToolWallService.DRAG;
    this.turn = this.start.turn + pixels * turn;
    this.open = Math.min(Math.max(this.start.open + pixels * open, 0), 1);
    this.emit({ type: 'inspect' });
  }

  /**
   * Cuelga la herramienta tomada, si hay una.
   *
   * @returns La herramienta que se colgó o `null`.
   */
  public hangAll(): ToolId | null {
    const previous = this.held;
    if (previous !== null) {
      this.held = null;
      this.emit({ type: 'hang', tool: previous });
    }
    return previous;
  }

  /**
   * Suscribe un oyente a los avisos de la pared.
   *
   * @param listener Oyente.
   * @returns Función para cancelar la suscripción.
   */
  public subscribe(listener: (event: ToolWallEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Avisa a los oyentes.
   *
   * @param event Aviso.
   */
  private emit(event: ToolWallEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
