import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../models/Powerable';
import type { PowerSwitch } from '../models/PowerSwitch';
import { SwitchedLine } from './SwitchedLine';

/**
 * Red eléctrica de la calle, detrás del MAIN del tablero del poste (patrón Composite + Observer): cada pieza
 * alimentada por la red cuelga de su propia {@link SwitchedLine} (así conserva su momento de encendido en la
 * intro) y todas se abren o cierran juntas. Quien tenga respaldo propio (el taller solar) se entera por
 * {@link PowerGrid.onChange}.
 */
export class PowerGrid implements PowerSwitch, Updatable {
  private readonly lines: SwitchedLine[] = [];
  private readonly listeners: ((closed: boolean) => void)[] = [];
  private closed = true;

  /**
   * Conecta una pieza a la red.
   *
   * @param target Pieza que recibe la energía.
   * @returns Línea de la pieza, que es la que se enciende en la intro.
   */
  public feed(target: Powerable): SwitchedLine {
    const line = new SwitchedLine(target);
    this.lines.push(line);
    return line;
  }

  /**
   * Avisa cada vez que la red se corta o vuelve (y de inmediato con el estado actual).
   *
   * @param listener Recibe `true` si hay red.
   */
  public onChange(listener: (closed: boolean) => void): void {
    this.listeners.push(listener);
    listener(this.closed);
  }

  /**
   * @inheritdoc
   */
  public setClosed(closed: boolean): void {
    if (closed === this.closed) {
      return;
    }
    this.closed = closed;
    this.lines.forEach((line) => {
      line.setClosed(closed);
    });
    this.listeners.forEach((listener) => {
      listener(closed);
    });
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.lines.forEach((line) => {
      line.update(delta, elapsed);
    });
  }
}
