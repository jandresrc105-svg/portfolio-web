import type { ContactChannel } from '@shared/core/events/ContactChannel';
import type { Updatable } from '@shared/engine/Updatable';
import { PhoneLine } from '../models/PhoneLine';
import type { PhoneDisplay } from '../models/PhoneDisplay';
import type { PhoneEvent } from '../models/PhoneEvent';
import { PhoneState } from '../models/PhoneState';

/**
 * Teléfono público de la cabina (máquina de estados + Observer): colgado, tono de marcar, llamando,
 * conectado y número sin asignar. Cada tecla del marcado rápido llama a un canal de contacto; al conectar
 * avisa con `connect` para que la página abra el canal. Los controles se identifican con `hook` (auricular),
 * `screen` (pantalla) o el texto de la tecla (`1`…`9`, `*`, `0`, `#`).
 */
export class PayPhoneService implements Updatable {
  public static readonly HOOK = 'hook';
  public static readonly SCREEN = 'screen';
  public static readonly KEYS: readonly string[] = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '*',
    '0',
    '#',
  ];

  private static readonly TIMING = {
    ringback: 2.4,
    unassigned: 1.5,
    ringEvery: 3.4,
    rings: 3,
    firstRing: 0.6,
  };
  private static readonly SEPARATOR = ' · ';

  private readonly listeners = new Set<(event: PhoneEvent) => void>();
  private channels: readonly ContactChannel[] = [];
  private current = PhoneState.OnHook;
  private channel: ContactChannel | null = null;
  private timer = 0;
  private rings = 0;
  private ringTimer = 0;

  /**
   * Estado actual.
   *
   * @returns Estado.
   */
  public get state(): PhoneState {
    return this.current;
  }

  /**
   * Indica si el auricular está fuera del gancho.
   *
   * @returns `true` si está descolgado.
   */
  public get lifted(): boolean {
    return this.current !== PhoneState.OnHook;
  }

  /**
   * Texto de la pantalla LCD según el estado.
   *
   * @returns Líneas de la pantalla.
   */
  public get display(): PhoneDisplay {
    const name = this.channel?.label.toUpperCase() ?? '';
    const texts: Record<PhoneState, PhoneDisplay> = {
      [PhoneState.OnHook]: { title: 'DESCUELGUE', detail: 'PARA LLAMAR' },
      [PhoneState.DialTone]: { title: 'MARQUE', detail: this.dialable() },
      [PhoneState.Calling]: { title: 'LLAMANDO…', detail: name },
      [PhoneState.Connected]: { title: 'CONECTADO', detail: `${name} ↗` },
      [PhoneState.Unassigned]: { title: 'NO ASIGNADO', detail: `MARQUE ${this.dialable()}` },
    };
    return texts[this.current];
  }

  /**
   * Canales del marcado rápido, en orden (la tecla `1` llama al primero).
   *
   * @returns Canales.
   */
  public get directory(): readonly ContactChannel[] {
    return this.channels;
  }

  /**
   * Fija los canales del marcado rápido.
   *
   * @param channels Canales en orden.
   */
  public setChannels(channels: readonly ContactChannel[]): void {
    this.channels = channels;
    this.emit({ type: 'state' });
  }

  /**
   * Avisa si la sección de contacto está abierta: al abrirla el teléfono suena unas veces; al salir se cuelga.
   *
   * @param active Si la sección de contacto está abierta.
   */
  public setActive(active: boolean): void {
    const { rings, firstRing } = PayPhoneService.TIMING;
    this.rings = active && !this.lifted ? rings : 0;
    this.ringTimer = firstRing;
    if (!active && this.lifted) {
      this.toggleHook();
    }
  }

  /**
   * Texto del tooltip de un control, o `null` si en este estado no hace nada.
   *
   * @param control Control (`hook`, `screen` o una tecla).
   * @returns Texto o `null`.
   */
  public describe(control: string): string | null {
    if (control === PayPhoneService.HOOK) {
      return this.lifted ? 'Colgar' : 'Descolgar el teléfono';
    }
    if (control === PayPhoneService.SCREEN) {
      return this.current === PhoneState.Connected && this.channel ? `Abrir ${this.channel.label}` : null;
    }
    const channel = this.channelFor(control);
    return channel ? `Marcar ${control}${PayPhoneService.SEPARATOR}${channel.label}` : `Tecla ${control}`;
  }

  /**
   * Usa un control: el auricular cuelga o descuelga, una tecla marca (descolgando si hace falta) y la
   * pantalla vuelve a abrir el canal conectado.
   *
   * @param control Control (`hook`, `screen` o una tecla).
   */
  public press(control: string): void {
    if (control === PayPhoneService.HOOK) {
      this.toggleHook();
    } else if (control === PayPhoneService.SCREEN) {
      this.reopen();
    } else if (PayPhoneService.KEYS.includes(control)) {
      this.dial(control);
    }
  }

  /**
   * Avanza el timbre, el tono de llamada y el aviso de número sin asignar.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    this.updateRinging(delta);
    if (this.current !== PhoneState.Calling && this.current !== PhoneState.Unassigned) {
      return;
    }
    this.timer -= delta;
    if (this.timer > 0) {
      return;
    }
    if (this.current === PhoneState.Calling) {
      this.connect();
    } else {
      this.enter(PhoneState.DialTone, PhoneLine.DialTone);
    }
  }

  /**
   * Suscribe un oyente a los avisos del teléfono.
   *
   * @param listener Función que recibe cada aviso.
   * @returns Función para cancelar la suscripción.
   */
  public on(listener: (event: PhoneEvent) => void): () => void {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Descuelga (tono de marcar) o cuelga (silencio).
   */
  private toggleHook(): void {
    const lifting = !this.lifted;
    this.rings = 0;
    this.channel = null;
    this.emit({ type: 'hook', lifted: lifting });
    if (lifting) {
      this.enter(PhoneState.DialTone, PhoneLine.DialTone);
    } else {
      this.enter(PhoneState.OnHook, PhoneLine.Silent);
    }
  }

  /**
   * Marca una tecla: con tono de marcar, llama al canal asignado o avisa que el número no existe.
   *
   * @param key Tecla.
   */
  private dial(key: string): void {
    if (!this.lifted) {
      this.toggleHook();
    }
    this.emit({ type: 'key', key });
    if (this.current !== PhoneState.DialTone) {
      return;
    }
    this.channel = this.channelFor(key);
    const { ringback, unassigned } = PayPhoneService.TIMING;
    this.timer = this.channel ? ringback : unassigned;
    if (this.channel) {
      this.enter(PhoneState.Calling, PhoneLine.Ringback);
    } else {
      this.enter(PhoneState.Unassigned, PhoneLine.Busy);
    }
  }

  /**
   * La llamada conecta: silencio en la línea y aviso para abrir el canal.
   */
  private connect(): void {
    this.enter(PhoneState.Connected, PhoneLine.Silent);
    this.reopen();
  }

  /**
   * Vuelve a pedir que se abra el canal conectado (por si el navegador bloqueó la ventana).
   */
  private reopen(): void {
    if (this.current === PhoneState.Connected && this.channel) {
      this.emit({ type: 'connect', channel: this.channel });
    }
  }

  /**
   * Hace sonar el timbre a intervalos mientras quedan timbrazos y el teléfono sigue colgado.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private updateRinging(delta: number): void {
    if (this.rings <= 0 || this.lifted) {
      return;
    }
    this.ringTimer -= delta;
    if (this.ringTimer <= 0) {
      this.rings -= 1;
      this.ringTimer = PayPhoneService.TIMING.ringEvery;
      this.emit({ type: 'ring' });
    }
  }

  /**
   * Cambia de estado y de tono, y avisa.
   *
   * @param state Nuevo estado.
   * @param line Tono de la línea.
   */
  private enter(state: PhoneState, line: PhoneLine): void {
    this.current = state;
    this.emit({ type: 'line', line });
    this.emit({ type: 'state' });
  }

  /**
   * Canal asignado a una tecla del marcado rápido.
   *
   * @param key Tecla.
   * @returns Canal o `null`.
   */
  private channelFor(key: string): ContactChannel | null {
    return this.channels[Number(key) - 1] ?? null;
  }

  /**
   * Teclas que tienen canal, para la pantalla ("1 · 2 · 3").
   *
   * @returns Texto.
   */
  private dialable(): string {
    return this.channels.map((_channel, index) => String(index + 1)).join(PayPhoneService.SEPARATOR);
  }

  /**
   * Avisa a todos los oyentes.
   *
   * @param event Aviso.
   */
  private emit(event: PhoneEvent): void {
    this.listeners.forEach((listener) => {
      listener(event);
    });
  }
}
