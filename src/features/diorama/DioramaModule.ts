import type { Container } from '@shared/core/di/Container';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { AppEventBus } from '@shared/core/events/AppEventBus';
import { SmoothScroll } from '@shared/core/scroll/SmoothScroll';
import { QualityDetector } from '@shared/engine/QualityDetector';
import { BootScreenComponent } from './components/BootScreenComponent';
import { DioramaComponent } from './components/DioramaComponent';
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
    container
      .singleton(SignalService, () => new SignalService())
      .singleton(
        DioramaExperienceFactory,
        (c) => new DioramaExperienceFactory(c.resolve(QualityDetector), c.resolve(SignalService)),
      )
      .transient(BootScreenComponent, () => new BootScreenComponent())
      .transient(
        DioramaComponent,
        (c) =>
          new DioramaComponent(
            c.resolve(DioramaExperienceFactory),
            c.resolve(SmoothScroll),
            c.resolve(AppEventBus),
            c.resolve(BootScreenComponent),
          ),
      );
  }
}
