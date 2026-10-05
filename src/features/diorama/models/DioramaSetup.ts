import type { QualityProfile } from '@shared/engine/QualityProfile';
import type { ThemeService } from '@shared/theme/ThemeService';
import type { Soundscape } from '../audio/Soundscape';
import type { DioramaDevices } from './DioramaDevices';
import type { Weather } from './Weather';

/**
 * Lo que necesita la experiencia 3D para armarse.
 */
export interface DioramaSetup {
  /** Perfil de calidad del dispositivo. */
  readonly quality: QualityProfile;
  /** Equipos de la escena que el visitante usa. */
  readonly devices: DioramaDevices;
  /** Paisaje sonoro. */
  readonly sound: Soundscape;
  /** Clima de la escena. */
  readonly weather: Weather;
  /** Apariencia (de día o de noche). */
  readonly theme: ThemeService;
}
