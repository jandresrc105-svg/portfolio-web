import { HttpClient } from '@shared/api/HttpClient';
import { PidLoopService } from '@shared/control/PidLoopService';
import type { Container } from '@shared/core/di/Container';
import { AppEventBus } from '@shared/core/events/AppEventBus';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import { SectionsApi } from './api/SectionsApi';
import { SectionsComponent } from './components/SectionsComponent';
import { SectionsService } from './services/SectionsService';

/**
 * Registra las dependencias de las secciones de contenido.
 */
export class SectionsModule implements FeatureModule {
  /**
   * @inheritdoc
   */
  public register(container: Container): void {
    container
      .singleton(SectionsApi, (c) => new SectionsApi(c.resolve(HttpClient)))
      .singleton(SectionsService, (c) => new SectionsService(c.resolve(SectionsApi)))
      .transient(
        SectionsComponent,
        (c) =>
          new SectionsComponent(
            c.resolve(SectionsService),
            c.resolve(AppEventBus),
            c.resolve(SectionNavigator),
            c.resolve(PidLoopService),
          ),
      );
  }
}
