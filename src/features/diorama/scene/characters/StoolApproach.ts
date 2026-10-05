import type { Vector3 } from 'three';
import type { StoolSeat } from '../../models/StoolSeat';
import type { CommuteRoute } from './CommuteRoute';

/**
 * Dónde se para un personaje para sentarse en uno de los taburetes de los extremos del camino (detrás del
 * taburete, mirando hacia la barra o la mesa) y dónde quedan sus pies de pie y sentado (en el mundo).
 */
export class StoolApproach {
  private static readonly STAND = 0.005;
  private static readonly TOUCHDOWN = { toward: 0.42, side: 0.13 };

  /**
   * Prepara las medidas de los taburetes del camino.
   *
   * @param route Camino (el primer taburete está al principio y el segundo al final).
   * @param first Taburete del principio del camino.
   */
  public constructor(
    private readonly route: CommuteRoute,
    private readonly first: StoolSeat,
  ) {}

  /**
   * Raíz de pie detrás de un taburete.
   *
   * @param seat Taburete.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  public standing(seat: StoolSeat, target: Vector3): Vector3 {
    this.route.sample(this.end(seat), target);
    target.y += this.route.ankle + StoolApproach.STAND;
    return target;
  }

  /**
   * Tobillo apoyado en el piso bajo el borde del asiento, a un lado del pie del taburete: donde pisa justo antes
   * de sentarse y justo al bajarse.
   *
   * @param seat Taburete.
   * @param side 1 = izquierdo, -1 = derecho.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  public touchdown(seat: StoolSeat, side: number, target: Vector3): Vector3 {
    this.route.sample(this.end(seat), target);
    const { toward, side: apart } = StoolApproach.TOUCHDOWN;
    target.x += (seat.seat.x - target.x) * toward + Math.cos(seat.heading) * side * apart;
    target.z += (seat.seat.z - target.z) * toward - Math.sin(seat.heading) * side * apart;
    target.y += this.route.ankle;
    return target;
  }

  /**
   * Tobillo sentado.
   *
   * @param seat Taburete.
   * @param side 1 = izquierdo, -1 = derecho.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  public seated(seat: StoolSeat, side: number, target: Vector3): Vector3 {
    const { x, y, z } = seat.foot;
    const cos = Math.cos(seat.heading);
    const sin = Math.sin(seat.heading);
    return target.set(
      seat.seat.x + side * x * cos + z * sin,
      seat.seat.y + y,
      seat.seat.z - side * x * sin + z * cos,
    );
  }

  /**
   * Un pie que va de un punto a otro levantándose en el medio (si de verdad se mueve).
   *
   * @param target Vector donde se escribe el punto.
   * @param from Punto de partida.
   * @param to Punto de llegada.
   * @param t Avance [0, 1].
   * @param lift Altura máxima del arco.
   */
  public arc(target: Vector3, from: Vector3, to: Vector3, t: number, lift: number): void {
    const far = from.distanceTo(to) > lift / 2;
    target.lerpVectors(from, to, t);
    target.y += far ? Math.sin(Math.PI * t) * lift : 0;
  }

  /**
   * Distancia del camino donde está el taburete.
   *
   * @param seat Taburete.
   * @returns 0 o el largo del camino.
   */
  private end(seat: StoolSeat): number {
    return seat === this.first ? 0 : this.route.length;
  }
}
