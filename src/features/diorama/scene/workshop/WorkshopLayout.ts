import { Vector3, type Object3D, type Vector3Like } from 'three';
import type { Placement } from '../../models/Placement';

/**
 * Ubicación y medidas compartidas del taller de electrónica, en el segundo piso del edificio del ramen y abierto
 * hacia la calle como una maqueta cortada. Las piezas del taller se construyen en su espacio local (origen en
 * el centro del piso, +z hacia la calle, +x a la derecha de quien mira desde afuera) y se colocan todas con la
 * misma transformación. También fija dónde van el osciloscopio y la placa del PID (en el banco, bajo el
 * estante de la fuente), la puerta de la escalera exterior (en la pared derecha) y la altura de la acera.
 */
export class WorkshopLayout {
  public static readonly SHOP = { width: 4.6, depth: 2, height: 2.45, wall: 0.06, floor: 0.06 };
  public static readonly DOOR = { z: 0.2, width: 0.7, height: 1.95 };
  public static readonly GROUND = -3.15;
  public static readonly BENCH = { width: 2.44, depth: 0.6, height: 0.9, top: 0.035, z: -0.64 };
  public static readonly PEGBOARD = { width: 2.44, height: 0.95, y: 1.8 };
  public static readonly TEST_SPOT = { x: 0.36, z: -0.52, stand: 0.035, tilt: 0.42 };
  public static readonly RISER = { x: -0.3, width: 0.62, depth: 0.24, y: 1.24, z: -0.8 };
  public static readonly ROTATION_Y = 0;
  public static readonly SCOPE = { x: -0.3, y: 0.9, z: -0.74, turn: 0.15 };
  public static readonly PLATE = { x: -0.32, y: 0.9, z: -0.45, turn: 0.1 };

  private static readonly POSITION = { x: 0, y: 3.25, z: -0.65 };
  private static readonly UP = new Vector3(0, 1, 0);

  /**
   * Cara del tablero perforado (la pared del fondo por dentro).
   *
   * @returns Coordenada z local.
   */
  public pegboardZ(): number {
    const { depth, wall } = WorkshopLayout.SHOP;
    return -depth / 2 + wall;
  }

  /**
   * Coloca una pieza del taller en su sitio de la escena.
   *
   * @param root Raíz de la pieza, construida en el espacio local del taller.
   */
  public place(root: Object3D): void {
    root.position.copy(WorkshopLayout.POSITION);
    root.rotation.y = WorkshopLayout.ROTATION_Y;
  }

  /**
   * Ubicación en la escena de una pieza que se arma aparte (la máquina, el osciloscopio, la placa).
   *
   * @param slot Punto local y giro extra respecto al taller.
   * @param slot.x Horizontal local.
   * @param slot.y Altura.
   * @param slot.z Profundidad local.
   * @param slot.turn Giro extra en Y.
   * @returns Posición y giro en la escena.
   */
  public placement(slot: { x: number; y: number; z: number; turn: number }): Placement {
    return { position: this.world(slot), rotationY: WorkshopLayout.ROTATION_Y + slot.turn };
  }

  /**
   * Convierte un punto del espacio local del taller al de la escena.
   *
   * @param local Punto local.
   * @returns Punto en la escena.
   */
  public world(local: Vector3Like): Vector3 {
    return new Vector3()
      .copy(local)
      .applyAxisAngle(WorkshopLayout.UP, WorkshopLayout.ROTATION_Y)
      .add(WorkshopLayout.POSITION);
  }
}
