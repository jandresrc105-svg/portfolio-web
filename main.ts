import { App } from '@app/App';
import { AppModule } from '@app/AppModule';
import { DioramaModule } from '@features/diorama/DioramaModule';
import { HeroModule } from '@features/hero/HeroModule';
import { SectionsModule } from '@features/sections/SectionsModule';
import { Container } from '@shared/core/di/Container';
import type { FeatureModule } from '@shared/core/di/FeatureModule';
import { SharedModule } from '@shared/SharedModule';

/**
 * Punto de entrada y raíz de composición: registra los módulos en el contenedor
 * de dependencias y monta la aplicación en el elemento `#root`.
 */
class Main {
  private static readonly ROOT_ID = 'root';

  private readonly container = new Container();

  /**
   * Inicializa la configuración del proyecto y monta la aplicación.
   *
   * @throws {Error} Si el elemento raíz no existe en index.html.
   */
  public start(): void {
    this.modules().forEach((module) => {
      module.register(this.container);
    });
    this.container.resolve(App).mount(this.root());
  }

  /**
   * Lista de módulos que componen la aplicación, en orden de registro.
   *
   * @returns Módulos a registrar.
   */
  private modules(): FeatureModule[] {
    return [new SharedModule(), new DioramaModule(), new HeroModule(), new SectionsModule(), new AppModule()];
  }

  /**
   * Obtiene el elemento raíz donde se monta la aplicación.
   *
   * @returns Elemento raíz.
   * @throws {Error} Si no existe.
   */
  private root(): HTMLElement {
    const root = document.getElementById(Main.ROOT_ID);
    if (!root) {
      throw new Error(`No se encontró el elemento #${Main.ROOT_ID} en index.html`);
    }
    return root;
  }
}

new Main().start();
