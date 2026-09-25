import { DioramaComponent } from '@features/diorama/components/DioramaComponent';
import { HeroComponent } from '@features/hero/components/HeroComponent';
import { SectionsComponent } from '@features/sections/components/SectionsComponent';
import type { Container } from '@shared/core/di/Container';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { App } from './App';

/**
 * Registra el contenedor principal con las features que compone.
 */
export class AppModule implements FeatureModule {
  /**
   * @inheritdoc
   */
  public register(container: Container): void {
    container.singleton(
      App,
      (c) => new App(c.resolve(DioramaComponent), c.resolve(HeroComponent), c.resolve(SectionsComponent)),
    );
  }
}
