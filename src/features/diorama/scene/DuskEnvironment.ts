import type { EnvironmentSpec } from '../models/EnvironmentSpec';
import { EnvironmentRoom } from './EnvironmentRoom';

/**
 * Ambiente de la tarde para el mapa de entorno: cielo rosado arriba, el sol naranja bajo detrás del puesto (del
 * lado del contraluz), un horizonte cálido alrededor y algo de neón al frente, que ya está encendido.
 */
export class DuskEnvironment extends EnvironmentRoom {
  private static readonly SPEC: EnvironmentSpec = {
    room: { size: 20, color: 0x2a1c34 },
    panels: [
      {
        color: 0xc98bb0,
        glow: 0.9,
        width: 20,
        height: 20,
        x: 0,
        y: 9.9,
        z: 0,
        rotationY: 0,
        rotationX: Math.PI / 2,
      },
      { color: 0xff8c42, glow: 7, width: 6, height: 2, x: 6, y: 1.5, z: -9.9, rotationY: 0, rotationX: 0 },
      {
        color: 0xff9a5c,
        glow: 1.4,
        width: 20,
        height: 4,
        x: 0,
        y: 1,
        z: -9.9,
        rotationY: 0,
        rotationX: 0,
      },
      {
        color: 0xff2d78,
        glow: 1,
        width: 10,
        height: 1.5,
        x: 0,
        y: 2,
        z: 9.9,
        rotationY: Math.PI,
        rotationX: 0,
      },
    ],
  };

  /**
   * Crea el ambiente de la tarde.
   */
  public constructor() {
    super(DuskEnvironment.SPEC);
  }
}
