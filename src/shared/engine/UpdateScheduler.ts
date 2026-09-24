import { Frustum, MathUtils, Matrix4, type Object3D, type PerspectiveCamera } from 'three';
import { ScheduledPiece } from './ScheduledPiece';
import type { Updatable } from './Updatable';

/**
 * Actualización a pedido de las piezas animadas (patrón Observer con prioridad): cada frame mira qué ve la
 * cámara y decide, por pieza, cuánto trabajo merece.
 * - Fuera de cámara: congelada en su último cuadro (ni lógica, ni redibujos de pantallas, ni matrices).
 * - En cámara pero pequeña (lejos): a ritmo reducido; la animación sigue viva, solo con menos pasos.
 * - En cámara y grande: a ritmo completo.
 * Además avisa a las piezas con pantallas (`DetailAware`) si se ven con detalle, para que no redibujen
 * pantallas que miden unos pocos píxeles.
 * Así una lata, una pantalla o un equipo del taller solo cuestan cuando se están mirando.
 */
export class UpdateScheduler implements Updatable {
  private static readonly NEAR_FRACTION = 0.6;
  private static readonly DETAIL_FRACTION = 0.25;
  private static readonly SLOW_RATE = 30;

  private readonly pieces: ScheduledPiece[] = [];
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();

  /**
   * Crea el planificador.
   *
   * @param camera Cámara con la que se decide qué se ve.
   */
  public constructor(private readonly camera: PerspectiveCamera) {}

  /**
   * Agrega una pieza animada.
   *
   * @param updatable Lógica de la pieza.
   * @param root Raíz 3D de la pieza (ya en la escena).
   */
  public track(updatable: Updatable, root: Object3D): void {
    this.pieces.push(new ScheduledPiece(updatable, root));
  }

  /**
   * Congela las matrices de estas piezas y libera las de las demás.
   *
   * @param roots Raíces de las piezas a congelar (vacío para liberar todas).
   */
  public hold(roots: readonly Object3D[]): void {
    this.pieces.forEach((piece) => {
      piece.setHeld(roots.some((root) => piece.owns(root)));
    });
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.camera.updateMatrixWorld();
    this.projection.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    const tangent = Math.tan(MathUtils.degToRad(this.camera.fov) / 2);
    this.pieces.forEach((piece) => {
      this.schedule(piece, tangent, delta, elapsed);
    });
  }

  /**
   * Decide y aplica el ritmo de una pieza.
   *
   * @param piece Pieza.
   * @param tangent Tangente de la mitad del campo de visión vertical.
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  private schedule(piece: ScheduledPiece, tangent: number, delta: number, elapsed: number): void {
    const bounds = piece.bounds;
    if (!bounds) {
      piece.run(delta, elapsed);
      return;
    }
    if (!this.frustum.intersectsSphere(bounds)) {
      piece.setDetailed(false);
      piece.hold(delta);
      return;
    }
    const distance = this.camera.position.distanceTo(bounds.center);
    const size = distance <= bounds.radius ? Infinity : bounds.radius / (distance * tangent);
    piece.setDetailed(size >= UpdateScheduler.DETAIL_FRACTION);
    if (size >= UpdateScheduler.NEAR_FRACTION) {
      piece.run(delta, elapsed);
    } else {
      piece.throttle(delta, elapsed, 1 / UpdateScheduler.SLOW_RATE);
    }
  }
}
