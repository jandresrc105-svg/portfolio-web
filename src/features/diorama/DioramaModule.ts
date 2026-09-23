import { AudioEngine } from '@shared/audio/AudioEngine';
import { PidLoopService } from '@shared/control/PidLoopService';
import type { Container } from '@shared/core/di/Container';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { AppEventBus } from '@shared/core/events/AppEventBus';
import { SectionNavigator } from '@shared/core/navigation/SectionNavigator';
import { QualityDetector } from '@shared/engine/QualityDetector';
import { BootScreenComponent } from './components/BootScreenComponent';
import { DioramaComponent } from './components/DioramaComponent';
import { SectionNavComponent } from './components/SectionNavComponent';
import { SoundToggleComponent } from './components/SoundToggleComponent';
import { DioramaExperienceFactory } from './experience/DioramaExperienceFactory';
import { BreakerPanelService } from './services/BreakerPanelService';
import { PayPhoneService } from './services/PayPhoneService';
import { ScopeControlService } from './services/ScopeControlService';
import { ScopeService } from './services/ScopeService';

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
      .singleton(ScopeService, () => new ScopeService())
      .singleton(PayPhoneService, () => new PayPhoneService())
      .singleton(BreakerPanelService, () => new BreakerPanelService())
      .singleton(
        ScopeControlService,
        (c) => new ScopeControlService(c.resolve(PidLoopService), c.resolve(ScopeService)),
      )
      .singleton(DioramaExperienceFactory, (c) => DioramaModule.experienceFactory(c));
  }

  /**
   * Fábrica de la experiencia 3D con los equipos que el visitante usa.
   *
   * @param container Contenedor de dependencias.
   * @returns Fábrica.
   */
  private static experienceFactory(container: Container): DioramaExperienceFactory {
    const devices = {
      instrument: container.resolve(ScopeControlService),
      phone: container.resolve(PayPhoneService),
      panel: container.resolve(BreakerPanelService),
    };
    return new DioramaExperienceFactory(
      container.resolve(QualityDetector),
      devices,
      container.resolve(AudioEngine),
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
      .transient(SectionNavComponent, (c) => new SectionNavComponent(c.resolve(SectionNavigator)))
      .transient(DioramaComponent, (c) => DioramaModule.diorama(c));
  }

  /**
   * Componente principal del diorama con sus dependencias y superposiciones.
   *
   * @param container Contenedor de dependencias.
   * @returns Componente del diorama.
   */
  private static diorama(container: Container): DioramaComponent {
    return new DioramaComponent(
      container.resolve(DioramaExperienceFactory),
      container.resolve(SectionNavigator),
      container.resolve(AppEventBus),
      container.resolve(BreakerPanelService),
      {
        boot: container.resolve(BootScreenComponent),
        soundToggle: container.resolve(SoundToggleComponent),
        nav: container.resolve(SectionNavComponent),
      },
    );
  }
}
