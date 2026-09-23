import { WireStep } from '../models/WireStep';
import type { WireEvent } from '../models/WireEvent';
import type { WireStationSource } from '../models/WireStationSource';
import type { WireStationState } from '../models/WireStationState';

/**
 * Estación de cableado del taller (máquina de estados + Observer): cortar un tramo del carrete, pelar la punta
 * con el pelacables, torcer los hilos, estañarlos con el cautín y apretarlos en la bornera. Es la única fuente
 * de verdad: la escena y el sonido solo escuchan. Pelar de más corta hilos y obliga a reiniciar. Los controles
 * son `reel`, `stripper`, `tip`, `iron`, `terminal` y `reset`.
 */
export class WireStationService implements WireStationSource {
  public static readonly REEL = 'reel';
  public static readonly STRIPPER = 'stripper';
  public static readonly TIP = 'tip';
  public static readonly IRON = 'iron';
  public static readonly TERMINAL = 'terminal';
  public static readonly RESET = 'reset';
  public static readonly PULL = { duration: 0.8 };
  public static readonly TIN = { duration: 3.2, touch: 0.42, release: 0.75 };
  public static readonly CONNECT = { duration: 1.6, slide: 0.3, screw: 0.9 };
  public static readonly STAGES = 5;

  private static readonly DURATION: Partial<Record<WireStep, number>> = {
    [WireStep.Pulling]: WireStationService.PULL.duration,
    [WireStep.Tinning]: WireStationService.TIN.duration,
    [WireStep.Connecting]: WireStationService.CONNECT.duration,
  };
  private static readonly NEXT: Partial<Record<WireStep, WireStep>> = {
    [WireStep.Pulling]: WireStep.Cut,
    [WireStep.Tinning]: WireStep.Tinned,
    [WireStep.Connecting]: WireStep.Connected,
  };
  private static readonly START: Partial<Record<WireStep, WireStep>> = {
    [WireStep.Spool]: WireStep.Pulling,
    [WireStep.Twisted]: WireStep.Tinning,
    [WireStep.Tinned]: WireStep.Connecting,
  };
  private static readonly STAGE: Record<WireStep, number> = {
    [WireStep.Spool]: 0,
    [WireStep.Pulling]: 0,
    [WireStep.Cut]: 1,
    [WireStep.Ruined]: 1,
    [WireStep.Stripped]: 2,
    [WireStep.Twisted]: 3,
    [WireStep.Tinning]: 3,
    [WireStep.Tinned]: 4,
    [WireStep.Connecting]: 4,
    [WireStep.Connected]: 5,
  };
  private static readonly TASKS: Partial<Record<WireStep, { control: string; text: string }>> = {
    [WireStep.Spool]: {
      control: WireStationService.REEL,
      text: 'Paso 1 · Cortar: clic en el carrete para tirar y cortar un tramo · Tip: deja cable de sobra, siempre se puede recortar',
    },
    [WireStep.Cut]: {
      control: WireStationService.STRIPPER,
      text: 'Paso 2 · Pelar: arrastra el pelacables hacia arriba · Tip: pela solo lo que entra en la bornera, sin morder el cobre',
    },
    [WireStep.Stripped]: {
      control: WireStationService.TIP,
      text: 'Paso 3 · Torcer: arrastra sobre la punta para trenzar los hilos · Tip: trenzados no se abren ni dejan pelos sueltos',
    },
    [WireStep.Twisted]: {
      control: WireStationService.IRON,
      text: 'Paso 4 · Estañar: clic en el cautín · Tip: estañar evita que los hilos se abran en la bornera',
    },
    [WireStep.Tinned]: {
      control: WireStationService.TERMINAL,
      text: 'Paso 5 · Conectar: clic en la bornera · Tip: aprieta firme y tira suave del cable para comprobarlo',
    },
  };
  private static readonly RUINED =
    'Demasiado: cortaste hilos · Menos hilos = menos sección, más calor y más resistencia · Pulsa Reiniciar';
  private static readonly DONE = 'Continuidad OK · LED verde: el circuito cierra sin falsos contactos';
  private static readonly DRAG = { strip: 150, over: 1.4, twist: 200 };
  private static readonly PERCENT = 100;

  private readonly listeners = new Set<(event: WireEvent) => void>();
  private step = WireStep.Spool;
  private strip = 0;
  private twist = 0;
  private timer = 0;
  private gripping = false;

  /**
   * Estado vigente.
   *
   * @returns Estado.
   */
  public get state(): WireStationState {
    const { step, strip, twist, timer, gripping } = this;
    return { step, stage: WireStationService.STAGE[step], strip, twist, timer, gripping };
  }

  /**
   * Texto del tooltip de un control, o `null` si ahora no hace nada.
   *
   * @param control Control.
   * @returns Texto o `null`.
   */
  public describe(control: string): string | null {
    if (control === WireStationService.RESET) {
      return `Reiniciar la estación · ${this.status()}`;
    }
    const task = WireStationService.TASKS[this.step];
    if (task?.control === control) {
      return `${task.text}${this.progress()}`;
    }
    if (this.step === WireStep.Ruined && WireStationService.isLead(control)) {
      return WireStationService.RUINED;
    }
    if (this.step === WireStep.Connected && control === WireStationService.TERMINAL) {
      return WireStationService.DONE;
    }
    return null;
  }

  /**
   * Usa un control con un clic: el carrete corta, el cautín estaña, la bornera conecta y Reiniciar vuelve al
   * principio. Fuera de su paso no hace nada.
   *
   * @param control Control.
   */
  public press(control: string): void {
    if (control === WireStationService.RESET) {
      this.reset();
      return;
    }
    const task = WireStationService.TASKS[this.step];
    if (task?.control !== control) {
      return;
    }
    const next = WireStationService.START[this.step];
    if (next) {
      this.begin(next);
    }
  }

  /**
   * Toma un control para arrastrarlo: el pelacables pela y la punta pelada se tuerce.
   *
   * @param control Control.
   * @returns Función que recibe el arrastre en píxeles, o `null` si ese control no se arrastra ahora.
   */
  public grab(control: string): ((pixels: number) => void) | null {
    if (this.step === WireStep.Cut && control === WireStationService.STRIPPER) {
      return this.stripSession();
    }
    if (this.step === WireStep.Stripped && control === WireStationService.TIP) {
      return this.twistSession();
    }
    return null;
  }

  /**
   * Vuelve al principio: carrete entero, sin tramo cortado.
   */
  public reset(): void {
    this.strip = 0;
    this.twist = 0;
    this.gripping = false;
    this.begin(WireStep.Spool);
  }

  /**
   * Avanza la animación del paso actual y, al terminarla, pasa al siguiente.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const duration = WireStationService.DURATION[this.step];
    if (duration === undefined) {
      return;
    }
    this.timer = Math.min(this.timer + delta / duration, 1);
    const next = WireStationService.NEXT[this.step];
    if (this.timer >= 1 && next) {
      this.begin(next);
    }
  }

  /**
   * Suscribe un oyente a los avisos de la estación.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: WireEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Arrastre del pelacables: el aislante sale con el arrastre; al llegar al final la punta queda pelada, y si
   * se sigue tirando se muerden y cortan hilos.
   *
   * @returns Función que recibe el arrastre en píxeles.
   */
  private stripSession(): (pixels: number) => void {
    const base = this.strip;
    this.gripping = true;
    this.emit({ type: 'state' });
    return (pixels: number): void => {
      const pulled = base + Math.abs(pixels) / WireStationService.DRAG.strip;
      if (this.step === WireStep.Cut) {
        this.strip = Math.min(Math.max(this.strip, pulled), 1);
        this.emit({ type: 'state' });
        if (this.strip >= 1) {
          this.begin(WireStep.Stripped);
        }
      } else if (this.step === WireStep.Stripped && pulled > WireStationService.DRAG.over) {
        this.ruin();
      }
    };
  }

  /**
   * Arrastre sobre la punta pelada: los hilos se tuercen hasta quedar trenzados.
   *
   * @returns Función que recibe el arrastre en píxeles.
   */
  private twistSession(): (pixels: number) => void {
    const base = this.twist;
    return (pixels: number): void => {
      if (this.step !== WireStep.Stripped) {
        return;
      }
      const turned = base + Math.abs(pixels) / WireStationService.DRAG.twist;
      this.twist = Math.min(Math.max(this.twist, turned), 1);
      this.emit({ type: 'state' });
      if (this.twist >= 1) {
        this.begin(WireStep.Twisted);
      }
    };
  }

  /**
   * Se peló de más: el pelacables mordió el cobre.
   */
  private ruin(): void {
    this.gripping = false;
    this.begin(WireStep.Ruined);
    this.emit({ type: 'ruined' });
  }

  /**
   * Empieza un paso y avisa.
   *
   * @param step Paso nuevo.
   */
  private begin(step: WireStep): void {
    this.step = step;
    this.timer = 0;
    this.emit({ type: 'step', step });
    this.emit({ type: 'state' });
  }

  /**
   * Resumen del paso actual para el botón Reiniciar.
   *
   * @returns Texto.
   */
  private status(): string {
    if (this.step === WireStep.Ruined) {
      return 'hilos cortados';
    }
    const stage = WireStationService.STAGE[this.step];
    if (stage >= WireStationService.STAGES) {
      return 'cable conectado';
    }
    return `paso ${String(stage + 1)} de ${String(WireStationService.STAGES)}`;
  }

  /**
   * Porcentaje del arrastre en curso (pelar o torcer), si ya empezó.
   *
   * @returns Texto a agregar al tooltip.
   */
  private progress(): string {
    const value = this.step === WireStep.Cut ? this.strip : this.twist;
    const dragging = this.step === WireStep.Cut || this.step === WireStep.Stripped;
    if (!dragging || value <= 0) {
      return '';
    }
    return ` · ${String(Math.round(value * WireStationService.PERCENT))} %`;
  }

  /**
   * Publica un aviso.
   *
   * @param event Aviso.
   */
  private emit(event: WireEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Indica si un control es parte del cable (el pelacables o la punta).
   *
   * @param control Control.
   * @returns `true` si es el pelacables o la punta.
   */
  private static isLead(control: string): boolean {
    return control === WireStationService.STRIPPER || control === WireStationService.TIP;
  }
}
