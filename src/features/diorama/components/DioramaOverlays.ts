import type { BootScreenComponent } from './BootScreenComponent';
import type { PerfHudComponent } from './PerfHudComponent';
import type { SectionNavComponent } from './SectionNavComponent';
import type { SoundToggleComponent } from './SoundToggleComponent';

/**
 * Componentes que el diorama monta sobre la página: consola de arranque, botón de sonido y riel de secciones.
 */
export interface DioramaOverlays {
  /** Pantalla de arranque mientras se prepara la escena. */
  readonly boot: BootScreenComponent;
  /** Botón para activar o silenciar el sonido. */
  readonly soundToggle: SoundToggleComponent;
  /** Riel de navegación entre secciones. */
  readonly nav: SectionNavComponent;
  /** Medidor de rendimiento (solo con `?perf` en la URL). */
  readonly perf: PerfHudComponent;
}
