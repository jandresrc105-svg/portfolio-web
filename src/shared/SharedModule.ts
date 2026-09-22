import { HttpClient } from './api/HttpClient';
import { AudioEngine } from './audio/AudioEngine';
import { Environment } from './config/Environment';
import type { Container } from './core/di/Container';
import type { FeatureModule } from './core/di/FeatureModule';
import { AppEventBus } from './core/events/AppEventBus';
import { SmoothScroll } from './core/scroll/SmoothScroll';
import { QualityDetector } from './engine/QualityDetector';

/**
 * Registra las dependencias compartidas por todas las features.
 */
export class SharedModule implements FeatureModule {
  /**
   * @inheritdoc
   */
  public register(container: Container): void {
    container
      .singleton(Environment, () => new Environment())
      .singleton(HttpClient, (c) => new HttpClient(c.resolve(Environment)))
      .singleton(AppEventBus, () => new AppEventBus())
      .singleton(SmoothScroll, () => new SmoothScroll())
      .singleton(QualityDetector, () => new QualityDetector())
      .singleton(AudioEngine, () => new AudioEngine());
  }
}
