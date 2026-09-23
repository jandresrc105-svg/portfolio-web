import { HttpClient } from './api/HttpClient';
import { AudioEngine } from './audio/AudioEngine';
import { Environment } from './config/Environment';
import { PidLoopService } from './control/PidLoopService';
import { PidSimulator } from './control/PidSimulator';
import type { Container } from './core/di/Container';
import type { FeatureModule } from './core/di/FeatureModule';
import { AppEventBus } from './core/events/AppEventBus';
import { SectionNavigator } from './core/navigation/SectionNavigator';
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
      .singleton(SectionNavigator, () => new SectionNavigator())
      .singleton(QualityDetector, () => new QualityDetector())
      .singleton(AudioEngine, () => new AudioEngine())
      .singleton(PidSimulator, () => new PidSimulator())
      .singleton(PidLoopService, (c) => new PidLoopService(c.resolve(PidSimulator)));
  }
}
