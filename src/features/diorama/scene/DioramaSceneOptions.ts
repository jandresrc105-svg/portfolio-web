import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import type { Weather } from '../models/Weather';
import type { ScopeControlService } from '../services/ScopeControlService';
import type { CanvasTextureFactory } from './CanvasTextureFactory';
import type { MaterialLibrary } from './MaterialLibrary';

/**
 * Dependencias con las que se construye el diorama.
 */
export interface DioramaSceneOptions {
  /** Materiales compartidos. */
  readonly materials: MaterialLibrary;
  /** Fábrica de texturas de canvas. */
  readonly textures: CanvasTextureFactory;
  /** Generador determinista. */
  readonly random: SeededRandom;
  /** Perfil de calidad. */
  readonly quality: QualityProfile;
  /** Tablero del osciloscopio: lazo PID y estado del equipo. */
  readonly instrument: ScopeControlService;
  /** Clima de la escena. */
  readonly weather: Weather;
}
