import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Módulo de matriz de LEDs 8×8 con controlador MAX7219, de pie sobre la protoboard y mirando al frente:
 * PCB azul, marco negro y 64 LEDs rojos en un solo `InstancedMesh` (cada uno emite con su propio brillo).
 * El brillo sube rápido y baja un poco más lento, como la persistencia del ojo. El grupo tiene origen al pie
 * del módulo.
 */
export class LedMatrix {
  public static readonly SIZE = 8;

  private static readonly PCB = { width: 0.13, height: 0.13, depth: 0.003, lift: 0.008, color: 0x1b4f8f };
  private static readonly FACE = { width: 0.12, height: 0.12, depth: 0.007, color: 0x0b0b0d };
  private static readonly LEGS = { width: 0.03, height: 0.008, depth: 0.004, color: 0x121214 };
  private static readonly LED = { radius: 0.0055, depth: 0.003, pitch: 0.0145 };
  private static readonly COLOR = 0xff3322;
  private static readonly GLOW = { on: 5, off: 0.035 };
  private static readonly FADE = { rise: 40, fall: 12 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly face = new MeshStandardMaterial({ color: LedMatrix.FACE.color, roughness: 0.5 });
  private readonly leds: InstancedMesh;
  private readonly brightness = new Float32Array(LedMatrix.SIZE * LedMatrix.SIZE);
  private readonly color = new Color();

  /**
   * Crea la matriz.
   */
  public constructor() {
    const { radius, depth } = LedMatrix.LED;
    this.leds = new InstancedMesh(
      new CylinderGeometry(radius, radius, depth, GeometryDetail.Low),
      new MeshBasicMaterial({ toneMapped: false }),
      LedMatrix.SIZE * LedMatrix.SIZE,
    );
    const { width, height, depth: thick } = LedMatrix.FACE;
    this.hitArea = new Mesh(new BoxGeometry(width, height, thick), this.face);
  }

  /**
   * Construye el módulo.
   *
   * @returns Grupo de la matriz.
   */
  public build(): Group {
    const pcb = LedMatrix.PCB;
    const center = pcb.lift + pcb.height / 2;
    const board = new Mesh(
      new BoxGeometry(pcb.width, pcb.height, pcb.depth),
      new MeshStandardMaterial({ color: pcb.color, roughness: 0.55 }),
    );
    board.position.y = center;
    const face = LedMatrix.FACE;
    this.hitArea.position.set(0, center, pcb.depth / 2 + face.depth / 2);
    const legs = LedMatrix.LEGS;
    const header = new Mesh(
      new BoxGeometry(legs.width, legs.height, legs.depth),
      new MeshStandardMaterial({ color: legs.color, roughness: 0.7 }),
    );
    header.position.y = legs.height / 2;
    this.placeLeds(center, pcb.depth / 2 + face.depth);
    this.group.add(board, this.hitArea, header, this.leds);
    return this.group;
  }

  /**
   * Lleva el brillo de cada LED hacia el que pide la matriz y lo pinta.
   *
   * @param matrix LEDs (fila × 8 + columna), 1 = encendido.
   * @param delta Segundos desde el frame anterior.
   * @param level Brillo general.
   */
  public show(matrix: ArrayLike<number>, delta: number, level: number): void {
    const { rise, fall } = LedMatrix.FADE;
    const { on, off } = LedMatrix.GLOW;
    for (let index = 0; index < this.brightness.length; index++) {
      const target = matrix[index] ?? 0;
      const current = this.brightness[index] ?? 0;
      const rate = target > current ? rise : fall;
      const next = current + (target - current) * Math.min(delta * rate, 1);
      this.brightness[index] = next;
      const glow = off + (on - off) * next * level;
      this.leds.setColorAt(index, this.color.set(LedMatrix.COLOR).multiplyScalar(glow));
    }
    if (this.leds.instanceColor) {
      this.leds.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Resalta el marco de la matriz.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    const { color, strength } = LedMatrix.HIGHLIGHT;
    this.face.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Cantidad de LEDs encendidos ahora (para el tooltip).
   *
   * @returns LEDs encendidos.
   */
  public lit(): number {
    return this.brightness.reduce((count, value) => count + (value > 0.5 ? 1 : 0), 0);
  }

  /**
   * Ubica los 64 LEDs en la cara del módulo, mirando al frente.
   *
   * @param center Altura del centro del módulo.
   * @param front Profundidad de la cara.
   */
  private placeLeds(center: number, front: number): void {
    const { pitch, depth } = LedMatrix.LED;
    const turn = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    const scale = new Vector3(1, 1, 1);
    const matrix = new Matrix4();
    const half = (LedMatrix.SIZE - 1) / 2;
    for (let index = 0; index < LedMatrix.SIZE * LedMatrix.SIZE; index++) {
      const row = Math.floor(index / LedMatrix.SIZE);
      const column = index % LedMatrix.SIZE;
      const at = new Vector3((column - half) * pitch, center + (half - row) * pitch, front + depth / 2);
      this.leds.setMatrixAt(index, matrix.compose(at, turn, scale));
      this.leds.setColorAt(index, this.color.set(LedMatrix.COLOR).multiplyScalar(LedMatrix.GLOW.off));
    }
  }
}
