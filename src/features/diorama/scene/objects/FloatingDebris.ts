import { DodecahedronGeometry, InstancedMesh, Object3D, Vector3 } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Fragmentos de roca y asfalto que orbitan lentamente alrededor de la isla, como si acabara de desprenderse.
 * Se dibujan con una sola llamada gracias a `InstancedMesh`.
 */
export class FloatingDebris extends SceneObject implements Updatable {
  private static readonly COUNT = 70;
  private static readonly RING = { min: 6.6, max: 11 };
  private static readonly HEIGHT = { min: -5.5, max: 1.2 };
  private static readonly SCALE = { min: 0.06, max: 0.36, bias: 1.4 };
  private static readonly SPIN = 0.35;
  private static readonly BOB = { amplitude: 0.18, speed: 0.6 };
  private static readonly ORBIT_SPEED = 0.012;

  private readonly dummy = new Object3D();
  private readonly pieces: { base: Vector3; axis: Vector3; spin: number; phase: number; scale: number }[] =
    [];
  private mesh: InstancedMesh | null = null;

  /**
   * Crea los fragmentos.
   *
   * @param materials Materiales compartidos.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    if (!this.mesh) {
      return;
    }
    const { amplitude, speed } = FloatingDebris.BOB;
    this.pieces.forEach((piece, index) => {
      this.dummy.position.copy(piece.base);
      this.dummy.position.y += Math.sin(elapsed * speed + piece.phase) * amplitude;
      this.dummy.quaternion.setFromAxisAngle(piece.axis, elapsed * piece.spin + piece.phase);
      this.dummy.scale.setScalar(piece.scale);
      this.dummy.updateMatrix();
      this.mesh?.setMatrixAt(index, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.root.rotation.y = elapsed * FloatingDebris.ORBIT_SPEED;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    for (let index = 0; index < FloatingDebris.COUNT; index += 1) {
      this.pieces.push(this.createPiece());
    }
    this.mesh = this.add(
      new InstancedMesh(new DodecahedronGeometry(1), this.materials.rock, FloatingDebris.COUNT),
    );
    this.update(0, 0);
  }

  /**
   * Genera un fragmento con posición, eje de giro y tamaño aleatorios.
   *
   * @returns Datos del fragmento.
   */
  private createPiece(): { base: Vector3; axis: Vector3; spin: number; phase: number; scale: number } {
    const angle = this.random.range(0, Math.PI * 2);
    const distance = this.random.range(FloatingDebris.RING.min, FloatingDebris.RING.max);
    const height = this.random.range(FloatingDebris.HEIGHT.min, FloatingDebris.HEIGHT.max);
    const axis = new Vector3(
      this.random.next() - 0.5,
      this.random.next() - 0.5,
      this.random.next() - 0.5,
    ).normalize();
    return {
      base: new Vector3(Math.cos(angle) * distance, height, Math.sin(angle) * distance),
      axis,
      spin: this.random.range(-FloatingDebris.SPIN, FloatingDebris.SPIN),
      phase: this.random.range(0, Math.PI * 2),
      scale:
        this.random.range(FloatingDebris.SCALE.min, FloatingDebris.SCALE.max) ** FloatingDebris.SCALE.bias *
        2,
    };
  }
}
