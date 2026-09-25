import { HttpClient } from '@shared/api/HttpClient';
import type { Container } from '@shared/core/di/Container';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { AppEventBus } from '@shared/core/events/AppEventBus';
import { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import { ProfileApi } from './api/ProfileApi';
import { HeroComponent } from './components/HeroComponent';
import { ProfileService } from './services/ProfileService';

/**
 * Registra las dependencias de la feature de presentación.
 */
export class HeroModule implements FeatureModule {
  /**
   * @inheritdoc
   */
  public register(container: Container): void {
    container
      .singleton(ProfileApi, (c) => new ProfileApi(c.resolve(HttpClient)))
      .singleton(ProfileService, (c) => new ProfileService(c.resolve(ProfileApi)))
      .transient(
        HeroComponent,
        (c) =>
          new HeroComponent(c.resolve(ProfileService), c.resolve(AppEventBus), c.resolve(SectionNavigator)),
      );
  }
}
