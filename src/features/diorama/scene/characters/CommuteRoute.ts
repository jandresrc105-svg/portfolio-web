import { CurvePath, LineCurve3, QuadraticBezierCurve3, Vector3, type Vector3Like } from 'three';
import type { WalkPath } from '../../models/WalkPath';
import { ShopStairs } from '../workshop/ShopStairs';

/**
 * Camino de Juan entre la barra del ramen y su puesto en el taller del segundo piso, sobre el suelo (en el
 * mundo): desde detrás de su taburete de la barra va por detrás de los taburetes y el frente de la acera, pasa
 * entre el puesto y la máquina expendedora, cruza bajo el tramo alto de la escalera, la rodea por la derecha,
 * da la vuelta hasta el pie (atrás), sube los catorce escalones, cruza el descanso, entra por la puerta del
 * costado y llega detrás del taburete de la mesa de los cables. Las esquinas van redondeadas (el cuerpo siempre
 * mira hacia donde avanza y cada pie pisa a su lado de la curva) y la escalera es un tramo recto. Las distancias
 * se miden a lo largo del camino. Sabe dónde apoyar cada pie: en lo plano, a un lado del camino; en la escalera,
 * en el centro de cada peldaño.
 */
export class CommuteRoute implements WalkPath {
  private static readonly POINTS: readonly Vector3Like[] = [
    { x: 0.47, y: 0.1, z: 1.8 },
    { x: 1.4, y: 0.1, z: 1.9 },
    { x: 2.72, y: 0.1, z: 1.97 },
    { x: 2.68, y: 0.1, z: -0.7 },
    { x: 3.6, y: 0.1, z: -1.5 },
    { x: 3.6, y: 0.1, z: -3.55 },
    { x: 3.3, y: 0.05, z: -4.1 },
    { x: 2.95, y: 0.1, z: -4.15 },
    { x: 2.95, y: 0.1, z: -3.72 },
    { x: 2.95, y: 3.25, z: -0.85 },
    { x: 2.95, y: 3.25, z: -0.45 },
    { x: 2.15, y: 3.25, z: -0.45 },
    { x: 1.9, y: 3.25, z: -0.55 },
  ];
  private static readonly CORNER = 0.45;
  private static readonly CLIMB_SLOPE = 0.5;
  private static readonly STEP = 0.55;
  private static readonly APPROACH = 0.9;
  private static readonly FOOT = { side: 0.09, ankle: 0.07 };
  private static readonly DIVISIONS = 4000;
  private static readonly CLEARANCE = 0.12;

  private readonly path = new CurvePath<Vector3>();
  private readonly footholds = ShopStairs.footholds();
  private readonly tangent = new Vector3();
  private stairs = { from: 0, to: 0, step: CommuteRoute.STEP };

  /**
   * Arma el camino.
   */
  public constructor() {
    this.path.arcLengthDivisions = CommuteRoute.DIVISIONS;
    this.build();
  }

  /**
   * Largo total del camino.
   *
   * @returns Metros.
   */
  public get length(): number {
    return this.path.getLength();
  }

  /**
   * Altura del tobillo sobre el suelo al pisar.
   *
   * @returns Metros.
   */
  public get ankle(): number {
    return CommuteRoute.FOOT.ankle;
  }

  /**
   * Cantidad de peldaños de la escalera.
   *
   * @returns Peldaños.
   */
  public get treads(): number {
    return this.footholds.length;
  }

  /**
   * Punto del suelo en el camino a una distancia desde la barra.
   *
   * @param distance Metros recorridos.
   * @param position Vector donde se escribe el punto.
   * @returns Rumbo (giro alrededor del eje vertical hacia el final del camino).
   */
  public sample(distance: number, position: Vector3): number {
    const u = this.at(distance);
    position.copy(this.path.getPointAt(u));
    this.path.getTangentAt(u, this.tangent);
    return Math.atan2(this.tangent.x, this.tangent.z);
  }

  /**
   * Cuánto de escalera hay en un punto del camino: 0 en lo plano, 1 en los peldaños y en medio al acercarse o
   * alejarse (para frenar y acortar el paso de a poco).
   *
   * @param distance Metros recorridos.
   * @returns Peso [0, 1].
   */
  public climb(distance: number): number {
    const { from, to } = this.stairs;
    const before = (distance - (from - CommuteRoute.APPROACH)) / CommuteRoute.APPROACH;
    const after = (to + CommuteRoute.APPROACH - distance) / CommuteRoute.APPROACH;
    return Math.min(Math.max(Math.min(before, after), 0), 1);
  }

  /**
   * Si un punto del camino está sobre los peldaños.
   *
   * @param distance Metros recorridos.
   * @returns `true` en la escalera.
   */
  public onStairs(distance: number): boolean {
    return distance > this.stairs.from && distance < this.stairs.to;
  }

  /**
   * Una distancia del camino llevada afuera de los peldaños, del lado hacia donde camina (para la pisada que
   * sale de la escalera: arriba en el descanso o abajo en el suelo, nunca en el aire entre dos peldaños).
   *
   * @param distance Metros recorridos hasta la pisada.
   * @param direction 1 si sube, -1 si baja.
   * @returns Distancia fuera de la escalera.
   */
  public offStairs(distance: number, direction: number): number {
    const { from, to } = this.stairs;
    const clearance = CommuteRoute.CLEARANCE;
    return direction > 0 ? Math.max(distance, to + clearance) : Math.min(distance, from - clearance);
  }

  /**
   * Largo de un paso en ese punto del camino: en la escalera, un peldaño por paso; al acercarse, se acorta de a
   * poco.
   *
   * @param distance Metros recorridos.
   * @returns Metros a lo largo del camino.
   */
  public stepAt(distance: number): number {
    const weight = this.climb(distance);
    return CommuteRoute.STEP + (this.stairs.step - CommuteRoute.STEP) * weight;
  }

  /**
   * Dónde apoyar un pie (el tobillo) en lo plano: a su lado del camino.
   *
   * @param distance Metros recorridos hasta la pisada.
   * @param side 1 = pie izquierdo (según hacia dónde camina), -1 = derecho.
   * @param direction 1 si va hacia el taller, -1 si vuelve a la barra.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  public footSpot(distance: number, side: number, direction: number, target: Vector3): Vector3 {
    const heading = this.sample(distance, target) + (direction < 0 ? Math.PI : 0);
    return this.beside(target, heading, side);
  }

  /**
   * Dónde apoyar un pie en un peldaño.
   *
   * @param index Peldaño (0 = el de abajo).
   * @param side 1 = pie izquierdo (según hacia dónde camina), -1 = derecho.
   * @param direction 1 si sube, -1 si baja.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  public treadSpot(index: number, side: number, direction: number, target: Vector3): Vector3 {
    target.copy(this.footholds[index] ?? target);
    return this.beside(target, direction > 0 ? 0 : Math.PI, side);
  }

  /**
   * Peldaño donde está apoyado un pie.
   *
   * @param ankle Tobillo.
   * @returns Índice del peldaño (0 = el de abajo) o -1 si no está en la escalera.
   */
  public treadOf(ankle: Vector3Like): number {
    const run = this.run();
    const ankleY = CommuteRoute.FOOT.ankle;
    return this.footholds.findIndex(
      (hold) => Math.abs(hold.z - ankle.z) < run / 2 && Math.abs(hold.y + ankleY - ankle.y) < run / 2,
    );
  }

  /**
   * Corre un punto a un costado del camino y lo sube a la altura del tobillo.
   *
   * @param target Punto del suelo.
   * @param heading Hacia dónde camina.
   * @param side 1 = izquierda, -1 = derecha.
   * @returns El mismo vector.
   */
  private beside(target: Vector3, heading: number, side: number): Vector3 {
    const offset = side * CommuteRoute.FOOT.side;
    target.x += Math.cos(heading) * offset;
    target.z -= Math.sin(heading) * offset;
    target.y += CommuteRoute.FOOT.ankle;
    return target;
  }

  /**
   * Fracción del camino a una distancia.
   *
   * @param distance Metros recorridos.
   * @returns Fracción [0, 1].
   */
  private at(distance: number): number {
    const length = this.length;
    return length > 0 ? Math.min(Math.max(distance / length, 0), 1) : 0;
  }

  /**
   * Distancia entre peldaños (en planta).
   *
   * @returns Metros.
   */
  private run(): number {
    return Math.abs((this.footholds[1]?.z ?? 0) - (this.footholds[0]?.z ?? 0));
  }

  /**
   * Arma el camino: tramos rectos con las esquinas redondeadas, salvo la escalera, que es un tramo recto entre
   * su pie y el descanso.
   */
  private build(): void {
    const points = CommuteRoute.POINTS.map((point) => new Vector3().copy(point));
    let cursor = points[0] ?? new Vector3();
    for (let index = 1; index < points.length - 1; index += 1) {
      cursor = this.corner(cursor, points[index - 1], points[index], points[index + 1]);
    }
    this.line(cursor, points[points.length - 1] ?? cursor);
  }

  /**
   * Agrega el tramo hasta una esquina y la curva que la redondea (o la esquina tal cual, si toca la escalera).
   *
   * @param cursor Donde termina lo ya armado.
   * @param previous Punto anterior.
   * @param point Esquina.
   * @param next Punto siguiente.
   * @returns Donde termina lo armado ahora.
   */
  private corner(cursor: Vector3, previous?: Vector3, point?: Vector3, next?: Vector3): Vector3 {
    if (!previous || !point || !next) {
      return cursor;
    }
    if (CommuteRoute.steep(previous, point) || CommuteRoute.steep(point, next)) {
      this.line(cursor, point);
      return point;
    }
    const radius = Math.min(CommuteRoute.CORNER, previous.distanceTo(point) / 2, next.distanceTo(point) / 2);
    const enter = point.clone().addScaledVector(previous.clone().sub(point).normalize(), radius);
    const leave = point.clone().addScaledVector(next.clone().sub(point).normalize(), radius);
    this.line(cursor, enter);
    this.path.add(new QuadraticBezierCurve3(enter, point, leave));
    return leave;
  }

  /**
   * Agrega un tramo recto (y, si es la escalera, anota dónde empieza y termina y cuánto mide cada peldaño a lo
   * largo del camino).
   *
   * @param from Inicio.
   * @param to Fin.
   */
  private line(from: Vector3, to: Vector3): void {
    if (from.distanceTo(to) === 0) {
      return;
    }
    const start = this.path.curves.length > 0 ? this.path.getLength() : 0;
    this.path.add(new LineCurve3(from, to));
    this.path.updateArcLengths();
    if (CommuteRoute.steep(from, to)) {
      const length = from.distanceTo(to);
      const plan = Math.hypot(to.x - from.x, to.z - from.z);
      this.stairs = { from: start, to: start + length, step: (this.run() * length) / plan };
    }
  }

  /**
   * Si un tramo es la escalera.
   *
   * @param from Inicio.
   * @param to Fin.
   * @returns `true` si sube o baja empinado.
   */
  private static steep(from: Vector3, to: Vector3): boolean {
    const plan = Math.hypot(to.x - from.x, to.z - from.z);
    return plan > 0 && Math.abs(to.y - from.y) / plan > CommuteRoute.CLIMB_SLOPE;
  }
}
