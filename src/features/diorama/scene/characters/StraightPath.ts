import { Vector3, type Vector3Like } from 'three';
import type { WalkPath } from '../../models/WalkPath';

/**
 * Camino recto y plano entre dos puntos del suelo (p. ej. el cocinero yendo de la olla a la barra), con pasos
 * cortos de andar por la cocina.
 */
export class StraightPath implements WalkPath {
  private static readonly STEP = 0.36;
  private static readonly SIDE = 0.085;

  public readonly treads = 0;

  private readonly from = new Vector3();
  private readonly to = new Vector3();

  /**
   * Arma el camino.
   *
   * @param from Punto de partida (en el suelo, en el mundo).
   * @param to Punto de llegada.
   * @param ankle Altura del tobillo sobre el suelo.
   */
  public constructor(
    from: Vector3Like,
    to: Vector3Like,
    public readonly ankle: number,
  ) {
    this.from.copy(from);
    this.to.copy(to);
  }

  /**
   * @inheritdoc
   */
  public get length(): number {
    return this.from.distanceTo(this.to);
  }

  /**
   * @inheritdoc
   */
  public sample(distance: number, position: Vector3): number {
    const length = this.length;
    position.lerpVectors(this.from, this.to, length > 0 ? Math.min(Math.max(distance / length, 0), 1) : 0);
    return Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z);
  }

  /**
   * @inheritdoc
   */
  public stepAt(): number {
    return StraightPath.STEP;
  }

  /**
   * @inheritdoc
   */
  public onStairs(): boolean {
    return false;
  }

  /**
   * @inheritdoc
   */
  public offStairs(distance: number): number {
    return distance;
  }

  /**
   * @inheritdoc
   */
  public footSpot(distance: number, side: number, direction: number, target: Vector3): Vector3 {
    const heading = this.sample(distance, target) + (direction < 0 ? Math.PI : 0);
    target.x += Math.cos(heading) * side * StraightPath.SIDE;
    target.z -= Math.sin(heading) * side * StraightPath.SIDE;
    target.y += this.ankle;
    return target;
  }

  /**
   * @inheritdoc
   */
  public treadSpot(_index: number, _side: number, _direction: number, target: Vector3): Vector3 {
    return target;
  }

  /**
   * @inheritdoc
   */
  public treadOf(): number {
    return -1;
  }
}
