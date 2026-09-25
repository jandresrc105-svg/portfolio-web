import { ToolId } from '../../models/ToolId';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { Crimper } from './Crimper';
import { DesolderPump } from './DesolderPump';
import { DiagonalCutter } from './DiagonalCutter';
import { DigitalCaliper } from './DigitalCaliper';
import { InsulatingTape } from './InsulatingTape';
import { NeedleNosePliers } from './NeedleNosePliers';
import { Screwdriver } from './Screwdriver';
import { SolderSpool } from './SolderSpool';
import { Tweezers } from './Tweezers';
import type { WallTool } from './WallTool';
import { WireStripper } from './WireStripper';

/**
 * Fábrica de las herramientas de la pared (patrón Factory): crea una de cada, en el orden de la pared.
 */
export class ToolRackFactory {
  /**
   * Crea la fábrica.
   *
   * @param textures Fábrica de texturas (escalas, etiquetas y pantallas).
   */
  public constructor(private readonly textures: CanvasTextureFactory) {}

  /**
   * Crea todas las herramientas (sin construir).
   *
   * @returns Herramientas.
   */
  public create(): WallTool[] {
    return [
      new DigitalCaliper(this.textures),
      new DiagonalCutter(),
      new NeedleNosePliers(),
      new WireStripper(this.textures),
      new Crimper(),
      new SolderSpool(this.textures),
      new InsulatingTape(),
      new DesolderPump(),
      new Screwdriver(ToolId.FlatDriver),
      new Screwdriver(ToolId.CrossDriver),
      new Screwdriver(ToolId.PrecisionDriver),
      new Tweezers(),
    ];
  }
}
