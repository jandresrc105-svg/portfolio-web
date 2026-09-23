import { ShopLightsControl } from '../models/ShopLightsControl';
import type { ShopLightsEvent } from '../models/ShopLightsEvent';
import type { ShopLightsState } from '../models/ShopLightsState';

/**
 * Luces y ambiente del taller (estado + Observer): cuatro palancas del tablero de interruptores (techo,
 * banco, letrero OPEN y bola de plasma) y un dimmer de corte de fase para el techo. El dimmer calcula el
 * ángulo de disparo del TRIAC que entrega la potencia pedida: con corte al inicio de cada semiciclo, la
 * fracción de potencia es `P(α) = 1 − α/π + sen(2α)/(2π)`, que se invierte por bisección.
 */
export class ShopLightsService {
  private static readonly LABELS: Record<ShopLightsControl, string> = {
    [ShopLightsControl.Ceiling]: 'Techo',
    [ShopLightsControl.Bench]: 'Banco',
    [ShopLightsControl.Sign]: 'Letrero OPEN',
    [ShopLightsControl.Plasma]: 'Bola de plasma',
    [ShopLightsControl.Dimmer]: 'Dimmer',
    [ShopLightsControl.Globe]: 'Bola de plasma',
  };
  private static readonly DIMMER = { initial: 0.8, min: 0.05, step: 0.01 };
  private static readonly PLASMA = { kilovolts: 5, kilohertz: 30 };
  private static readonly BISECTION = { steps: 24 };
  private static readonly PERCENT = 100;
  private static readonly DEGREES = 180;

  private readonly listeners = new Set<(event: ShopLightsEvent) => void>();
  private readonly switches = new Map<ShopLightsControl, boolean>([
    [ShopLightsControl.Ceiling, true],
    [ShopLightsControl.Bench, true],
    [ShopLightsControl.Sign, true],
    [ShopLightsControl.Plasma, true],
  ]);
  private dimmer = ShopLightsService.DIMMER.initial;

  /**
   * Estado actual de las luces.
   *
   * @returns Estado.
   */
  public get state(): ShopLightsState {
    return {
      ceiling: this.isOn(ShopLightsControl.Ceiling),
      bench: this.isOn(ShopLightsControl.Bench),
      sign: this.isOn(ShopLightsControl.Sign),
      plasma: this.isOn(ShopLightsControl.Plasma),
      dimmer: this.dimmer,
      firingAngle: ShopLightsService.firingAngle(this.dimmer),
    };
  }

  /**
   * Texto del tooltip de un control, o `null` si no es un control de las luces.
   *
   * @param control Id del control.
   * @returns Texto o `null`.
   */
  public describe(control: string): string | null {
    const id = ShopLightsService.parse(control);
    if (id === null) {
      return null;
    }
    if (id === ShopLightsControl.Dimmer) {
      return this.describeDimmer();
    }
    if (id === ShopLightsControl.Globe && this.isOn(ShopLightsControl.Plasma)) {
      const { kilovolts, kilohertz } = ShopLightsService.PLASMA;
      return `Bola de plasma · ${String(kilovolts)} kV, ${String(kilohertz)} kHz`;
    }
    const on = this.isOn(ShopLightsService.switchOf(id));
    return `${ShopLightsService.LABELS[id]} · ${on ? 'Apagar' : 'Encender'}`;
  }

  /**
   * Acciona una palanca (o la bola de plasma, que comparte la palanca de su circuito).
   *
   * @param control Id del control.
   */
  public press(control: string): void {
    const id = ShopLightsService.parse(control);
    if (id === null || id === ShopLightsControl.Dimmer) {
      return;
    }
    const key = ShopLightsService.switchOf(id);
    const on = !this.isOn(key);
    this.switches.set(key, on);
    this.emit({ type: 'switch', control: key, on });
  }

  /**
   * Gira el dimmer (se limita a su recorrido y se redondea al 1 %).
   *
   * @param level Posición pedida [0, 1].
   */
  public setDimmer(level: number): void {
    const { min, step } = ShopLightsService.DIMMER;
    const next = Math.round(Math.min(Math.max(level, min), 1) / step) * step;
    if (next === this.dimmer) {
      return;
    }
    this.dimmer = next;
    this.emit({ type: 'dimmer', level: next });
  }

  /**
   * Suscribe un oyente a los avisos de las luces.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: ShopLightsEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Tooltip del dimmer: posición y ángulo de disparo del TRIAC (o aviso si el techo está apagado).
   *
   * @returns Texto.
   */
  private describeDimmer(): string {
    const percent = `Dimmer ${String(Math.round(this.dimmer * ShopLightsService.PERCENT))} %`;
    if (!this.isOn(ShopLightsControl.Ceiling)) {
      return `${percent} · Techo apagado`;
    }
    const angle = Math.round(ShopLightsService.firingAngle(this.dimmer));
    return `${percent} · TRIAC a ${String(angle)}°`;
  }

  /**
   * Indica si una palanca está arriba.
   *
   * @param control Palanca.
   * @returns `true` si está encendida.
   */
  private isOn(control: ShopLightsControl): boolean {
    return this.switches.get(control) ?? false;
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: ShopLightsEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Convierte un id de control en el control de las luces, si lo es.
   *
   * @param control Id recibido.
   * @returns Control o `null`.
   */
  private static parse(control: string): ShopLightsControl | null {
    return (Object.values(ShopLightsControl) as string[]).includes(control)
      ? (control as ShopLightsControl)
      : null;
  }

  /**
   * Palanca que gobierna un control (la bola de plasma usa la palanca de su circuito).
   *
   * @param control Control.
   * @returns Palanca.
   */
  private static switchOf(control: ShopLightsControl): ShopLightsControl {
    return control === ShopLightsControl.Globe ? ShopLightsControl.Plasma : control;
  }

  /**
   * Ángulo de disparo del TRIAC que entrega una fracción de la potencia (dimmer de corte al inicio).
   *
   * @param power Fracción de potencia [0, 1].
   * @returns Ángulo en grados.
   */
  private static firingAngle(power: number): number {
    let low = 0;
    let high = Math.PI;
    for (let step = 0; step < ShopLightsService.BISECTION.steps; step += 1) {
      const middle = (low + high) / 2;
      if (ShopLightsService.powerAt(middle) > power) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return (((low + high) / 2) * ShopLightsService.DEGREES) / Math.PI;
  }

  /**
   * Fracción de potencia que llega a la carga con un ángulo de disparo dado.
   *
   * @param angle Ángulo en radianes [0, π].
   * @returns Fracción [0, 1].
   */
  private static powerAt(angle: number): number {
    return 1 - angle / Math.PI + Math.sin(2 * angle) / (2 * Math.PI);
  }
}
