import { AudioEngine } from '@shared/audio/AudioEngine';
import type { Container } from '@shared/core/di/Container';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { AppEventBus } from '@shared/core/events/AppEventBus';
import { SmoothScroll } from '@shared/core/scroll/SmoothScroll';
import { QualityDetector } from '@shared/engine/QualityDetector';
import { BootScreenComponent } from './components/BootScreenComponent';
import { DioramaComponent } from './components/DioramaComponent';
import { SoundToggleComponent } from './components/SoundToggleComponent';
import { DioramaExperienceFactory } from './experience/DioramaExperienceFactory';
import { SignalService } from './services/SignalService';

/**
 * Registra las dependencias del diorama 3D.
 */
export class DioramaModule implements FeatureModule {
  /**
   * @inheritdoc
   */
  public register(container: Container): void {
    DioramaModule.registerServices(container);
    DioramaModule.registerComponents(container);
  }

  /**
   * Services y fábrica de la experiencia 3D.
   *
   * @param container Contenedor de dependencias.
   */
  private static registerServices(container: Container): void {
    container
      .singleton(SignalService, () => new SignalService())
      .singleton(
        DioramaExperienceFactory,
        (c) =>
          new DioramaExperienceFactory(
            c.resolve(QualityDetector),
            c.resolve(SignalService),
            c.resolve(AudioEngine),
          ),
      );
  }

  /**
   * Componentes del diorama.
   *
   * @param container Contenedor de dependencias.
   */
  private static registerComponents(container: Container): void {
    container
      .transient(BootScreenComponent, () => new BootScreenComponent())
      .transient(SoundToggleComponent, (c) => new SoundToggleComponent(c.resolve(AudioEngine)))
      .transient(
        DioramaComponent,
        (c) =>
          new DioramaComponent(
            c.resolve(DioramaExperienceFactory),
            c.resolve(SmoothScroll),
            c.resolve(AppEventBus),
            c.resolve(BootScreenComponent),
            c.resolve(SoundToggleComponent),
          ),
      );
  }
}
