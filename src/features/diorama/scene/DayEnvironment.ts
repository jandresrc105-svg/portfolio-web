import type { EnvironmentSpec } from '../models/EnvironmentSpec';
import { EnvironmentRoom } from './EnvironmentRoom';

/**
 * Ambiente del día para el mapa de entorno: cielo celeste arriba, el sol cálido adelante a la derecha (del lado
 * de la luz directa del sol) y un suelo tibio que rebota luz desde abajo.
 */
export class DayEnvironment extends EnvironmentRoom {
  private static readonly SPEC: EnvironmentSpec = {
    room: { size: 20, color: 0x5d7792 },
    panels: [
      {
        color: 0xbcdcff,
        glow: 1.6,
        width: 20,
        height: 20,
        x: 0,
        y: 9.9,
        z: 0,
        rotationY: 0,
        rotationX: Math.PI / 2,
      },
      { color: 0xfff0d2, glow: 9, width: 3, height: 3, x: 5, y: 7, z: 9.9, rotationY: Math.PI, rotationX: 0 },
      {
        color: 0xa9c8ea,
        glow: 1.1,
        width: 20,
        height: 6,
        x: 0,
        y: 3,
        z: -9.9,
        rotationY: 0,
        rotationX: 0,
      },
      {
        color: 0x8a7a66,
        glow: 0.7,
        width: 20,
        height: 20,
        x: 0,
        y: -9.9,
        z: 0,
        rotationY: 0,
        rotationX: -Math.PI / 2,
      },
    ],
  };

  /**
   * Crea el ambiente del día.
   */
  public constructor() {
    super(DayEnvironment.SPEC);
  }
}
