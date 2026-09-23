import type { AmbientLoop } from '../audio/AmbientLoop';
import type { InterfaceSound } from '../audio/InterfaceSound';
import type { NeonHum } from '../audio/NeonHum';
import type { PhoneSound } from '../audio/PhoneSound';
import type { Soundtrack } from '../audio/Soundtrack';
import type { SwitchSound } from '../audio/SwitchSound';
import type { ThunderSound } from '../audio/ThunderSound';

/**
 * Voces del paisaje sonoro, creadas cuando el audio empieza a sonar.
 */
export interface SoundVoices {
  /** Lluvia ambiental en bucle. */
  readonly rain: AmbientLoop;
  /** Música lofi de fondo. */
  readonly music: Soundtrack;
  /** Zumbido del neón principal. */
  readonly hum: NeonHum;
  /** Chasquidos de encendido. */
  readonly switches: SwitchSound;
  /** Truenos. */
  readonly thunder: ThunderSound;
  /** Sonidos de interfaz. */
  readonly ui: InterfaceSound;
  /** Timbre, teclas y tonos del teléfono de la cabina. */
  readonly phone: PhoneSound;
}
