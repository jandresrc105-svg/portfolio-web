import type { AudioEngine } from '@shared/audio/AudioEngine';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import type { MaterialLibrary } from '../scene/MaterialLibrary';
import type { WorkshopLayout } from '../scene/workshop/WorkshopLayout';

/**
 * Lo que recibe cada equipo del taller al crearse.
 */
export interface WorkshopContext {
  /** Materiales compartidos del diorama. */
  readonly materials: MaterialLibrary;
  /** Fábrica de texturas de canvas (pantallas, serigrafías, etiquetas). */
  readonly textures: CanvasTextureFactory;
  /** Ubicación del taller: coloca las piezas y convierte puntos locales a la escena. */
  readonly layout: WorkshopLayout;
  /** Motor de audio compartido, para los sonidos propios del equipo (sintetizados con Web Audio). */
  readonly audio: AudioEngine;
  /** Generador determinista. */
  readonly random: SeededRandom;
}
