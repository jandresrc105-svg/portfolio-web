import {
  BoxGeometry,
  CatmullRomCurve3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Placa de circuito sobre la barra, conectada al osciloscopio con una sonda y con un LED que late.
 */
export class CircuitBoard extends SceneObject implements Updatable, Powerable {
  private static readonly POSITION = { x: -0.55, y: 1.095, z: 0.9 };
  private static readonly ROTATION_Y = -0.3;
  private static readonly BOARD = { width: 0.34, height: 0.016, depth: 0.22, color: 0x0b5a34 };
  private static readonly CHIPS = [
    { x: -0.08, z: -0.03, width: 0.09, depth: 0.06 },
    { x: 0.07, z: 0.04, width: 0.06, depth: 0.06 },
    { x: 0.08, z: -0.06, width: 0.04, depth: 0.03 },
  ];
  private static readonly CHIP_HEIGHT = 0.018;
  private static readonly LED = { size: 0.018, x: -0.12, z: 0.07, color: 0x4dd8ff, glow: 6, speed: 2.2 };
  private static readonly PROBE = { radius: 0.006, color: 0x1d4ed8 };
  private static readonly PROBE_PATH = [
    { x: -0.12, y: 0.05, z: -0.05 },
    { x: -0.3, y: 0.02, z: -0.1 },
    { x: -0.5, y: 0.03, z: -0.2 },
    { x: -0.62, y: 0.12, z: -0.14 },
  ];
  private static readonly OFF_GLOW = 0.03;

  private readonly led = new MeshBasicMaterial({ color: CircuitBoard.LED.color });
  private level = 0;

  /**
   * Crea la placa.
   *
   * @param materials Materiales compartidos.
   */
  public constructor(private readonly materials: MaterialLibrary) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const { color, glow, speed } = CircuitBoard.LED;
    const pulse = (Math.sin(elapsed * speed) + 1) / 2;
    this.led.color.set(color).multiplyScalar(Math.max(this.level * pulse * glow, CircuitBoard.OFF_GLOW));
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { width, height, depth, color } = CircuitBoard.BOARD;
    const board = new MeshStandardMaterial({ color, roughness: 0.5 });
    this.add(new Mesh(new BoxGeometry(width, height, depth), board), { x: 0, y: height / 2, z: 0 });
    CircuitBoard.CHIPS.forEach((chip) => {
      const geometry = new BoxGeometry(chip.width, CircuitBoard.CHIP_HEIGHT, chip.depth);
      this.add(new Mesh(geometry, this.materials.ceramic), {
        x: chip.x,
        y: height + CircuitBoard.CHIP_HEIGHT / 2,
        z: chip.z,
      });
    });
    const { size, x, z } = CircuitBoard.LED;
    this.add(new Mesh(new BoxGeometry(size, size, size), this.led), { x, y: height + size / 2, z });
    this.buildProbe();
    this.root.position.copy(CircuitBoard.POSITION);
    this.root.rotation.y = CircuitBoard.ROTATION_Y;
  }

  /**
   * Cable de sonda que serpentea hasta el osciloscopio.
   */
  private buildProbe(): void {
    const points = CircuitBoard.PROBE_PATH.map((point) => new Vector3(point.x, point.y, point.z));
    const { radius, color } = CircuitBoard.PROBE;
    const material = new MeshStandardMaterial({ color, roughness: 0.4 });
    this.add(
      new Mesh(
        new TubeGeometry(new CatmullRomCurve3(points), GeometryDetail.Smooth, radius, GeometryDetail.Thin),
        material,
      ),
    );
  }
}
