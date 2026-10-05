import type { EnvironmentSpec } from '../models/EnvironmentSpec';
import { EnvironmentRoom } from './EnvironmentRoom';

/**
 * Ambiente de la noche para el mapa de entorno: una caja oscura con franjas del color de los neones, los
 * faroles y la luna.
 */
export class NeonEnvironment extends EnvironmentRoom {
  private static readonly SPEC: EnvironmentSpec = {
    room: { size: 20, color: 0x07060e },
    panels: [
      { color: 0xff2d78, glow: 1.8, width: 9, height: 1.6, x: 0, y: 5, z: -9, rotationY: 0, rotationX: 0 },
      {
        color: 0x3fd8ff,
        glow: 4,
        width: 6,
        height: 1.2,
        x: 9,
        y: 3,
        z: 1,
        rotationY: -Math.PI / 2,
        rotationX: 0,
      },
      {
        color: 0xff8a3d,
        glow: 1.8,
        width: 5,
        height: 2,
        x: -9,
        y: 2.5,
        z: -1,
        rotationY: Math.PI / 2,
        rotationX: 0,
      },
      {
        color: 0x7d95ff,
        glow: 1.4,
        width: 14,
        height: 14,
        x: 0,
        y: 9.5,
        z: 0,
        rotationY: 0,
        rotationX: Math.PI / 2,
      },
      {
        color: 0xff5aa8,
        glow: 0.6,
        width: 10,
        height: 1.5,
        x: 0,
        y: 2,
        z: 9,
        rotationY: Math.PI,
        rotationX: 0,
      },
    ],
  };

  /**
   * Crea el ambiente de la noche.
   */
  public constructor() {
    super(NeonEnvironment.SPEC);
  }
}
