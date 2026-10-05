import { Vector3, type Vector3Like } from 'three';
import type { WalkPath } from '../../models/WalkPath';

/**
 * Pisadas de un personaje que camina (en el mundo): cada pie queda clavado donde pisó mientras sostiene el
 * cuerpo y el otro viaja en arco hasta su próxima pisada, medio paso por delante de la cadera, así los pies no
 * patinan. Un paso dura lo que el cuerpo tarda en avanzar un largo de paso. El pie despega levantando el talón
 * (punta abajo) y aterriza de talón (punta arriba), y al final del apoyo el talón se despega del suelo. En la
 * escalera cada paso sube un peldaño y el pie se levanta más para librar el borde.
 */
export class Footsteps {
  private static readonly SIDES = [1, -1];
  private static readonly LEAD = 1.5;
  private static readonly CLEAR = { flat: 0.1, stairs: 0.11, rise: 1.7, peak: 0.65 };
  private static readonly PITCH = { off: 0.45, strike: -0.25, settle: 0.2, heel: 0.75, stairs: 0.45 };
  private static readonly FOOT = { toe: 0.12, heel: 0.05 };
  private static readonly CLIMB = 0.02;

  private readonly plants = [new Vector3(), new Vector3()];
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private swinging = -1;
  private next = 0;
  private progress = 0;
  private climbing = false;

  /**
   * Cuánto avanzó el paso en curso [0, 1].
   *
   * @returns Avance.
   */
  public get stride(): number {
    return this.swinging < 0 ? 0 : this.progress;
  }

  /**
   * Pie que está en el aire.
   *
   * @returns 1 = izquierdo, -1 = derecho, 0 si los dos apoyan.
   */
  public get swingSide(): number {
    return this.swinging < 0 ? 0 : (Footsteps.SIDES[this.swinging] ?? 0);
  }

  /**
   * Si el paso en curso sube o baja un peldaño.
   *
   * @returns `true` en la escalera.
   */
  public get onStairs(): boolean {
    return this.climbing;
  }

  /**
   * Apoya los dos pies (al empezar a caminar).
   *
   * @param left Tobillo izquierdo.
   * @param right Tobillo derecho.
   */
  public place(left: Vector3Like, right: Vector3Like): void {
    this.plants[0]?.copy(left);
    this.plants[1]?.copy(right);
    this.swinging = -1;
    this.progress = 0;
  }

  /**
   * Avanza las pisadas lo que avanzó el cuerpo.
   *
   * @param route Camino.
   * @param distance Metros recorridos por el cuerpo.
   * @param direction 1 hacia el taller, -1 hacia la barra.
   * @param advance Metros que avanzó en este frame.
   */
  public advance(route: WalkPath, distance: number, direction: number, advance: number): void {
    const step = route.stepAt(distance);
    if (this.swinging < 0) {
      this.begin(route, distance, direction, step);
    }
    this.progress += advance / step;
    while (this.progress >= 1) {
      this.plants[this.swinging]?.copy(this.to);
      this.progress -= 1;
      this.begin(route, distance, direction, step);
    }
  }

  /**
   * Dónde está un tobillo ahora.
   *
   * @param side 1 = izquierdo, -1 = derecho.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  public foot(side: number, target: Vector3): Vector3 {
    const index = Footsteps.SIDES.indexOf(side);
    if (index === this.swinging) {
      this.arc(target);
    } else {
      target.copy(this.plants[index] ?? target);
    }
    const pitch = this.pitch(side);
    target.y += pitch > 0 ? Footsteps.FOOT.toe * Math.sin(pitch) : Footsteps.FOOT.heel * Math.sin(-pitch);
    return target;
  }

  /**
   * Inclinación de un pie: positiva con la punta abajo (despegando), negativa con la punta arriba (pisando de
   * talón).
   *
   * @param side 1 = izquierdo, -1 = derecho.
   * @returns Radianes.
   */
  public pitch(side: number): number {
    if (this.swinging < 0) {
      return 0;
    }
    const { off, strike, settle, heel, stairs } = Footsteps.PITCH;
    const s = this.progress;
    const scale = this.climbing ? stairs : 1;
    if (Footsteps.SIDES.indexOf(side) === this.swinging) {
      return (off + (strike - off) * Footsteps.ease(s, 0, 1)) * scale;
    }
    return (strike * (1 - Footsteps.ease(s, 0, settle)) + off * Footsteps.ease(s, heel, 1)) * scale;
  }

  /**
   * Altura media del suelo bajo los dos pies (la del pie en el aire, entre donde despegó y donde va a pisar).
   *
   * @returns Altura de los tobillos apoyados.
   */
  public support(): number {
    const [left, right] = this.plants.map((plant) => plant.y);
    if (this.swinging < 0) {
      return ((left ?? 0) + (right ?? 0)) / 2;
    }
    const stance = (this.swinging === 0 ? right : left) ?? 0;
    const swing = this.from.y + (this.to.y - this.from.y) * Footsteps.ease(this.progress, 0, 1);
    return (stance + swing) / 2;
  }

  /**
   * Empieza el paso del pie que sigue: despega de donde está y apunta medio paso por delante de donde va a estar
   * el cuerpo al pisar.
   *
   * @param route Camino.
   * @param distance Metros recorridos por el cuerpo.
   * @param direction 1 hacia el taller, -1 hacia la barra.
   * @param step Largo del paso.
   */
  private begin(route: WalkPath, distance: number, direction: number, step: number): void {
    this.swinging = this.next;
    this.next = 1 - this.next;
    this.from.copy(this.plants[this.swinging] ?? this.from);
    const side = Footsteps.SIDES[this.swinging] ?? 1;
    const land = Math.min(Math.max(distance + direction * Footsteps.LEAD * step, 0), route.length);
    const tread = this.nextTread(route, land, direction);
    if (tread === null) {
      route.footSpot(land, side, direction, this.to);
    } else if (tread < 0) {
      route.footSpot(route.offStairs(land, direction), side, direction, this.to);
    } else {
      route.treadSpot(tread, side, direction, this.to);
    }
    this.climbing = Math.abs(this.to.y - this.from.y) > Footsteps.CLIMB;
  }

  /**
   * Peldaño que pisa el pie que sale: el que sigue al del pie que apoya (cada pie sube o baja uno más que el
   * otro, sin repetir ni saltarse ninguno) o, si el otro pie todavía está fuera, el primero que encuentra.
   *
   * @param route Camino.
   * @param land Distancia donde pisaría en lo plano.
   * @param direction 1 si sube, -1 si baja.
   * @returns Peldaño, -1 si sale de la escalera o `null` si pisa en lo plano.
   */
  private nextTread(route: WalkPath, land: number, direction: number): number | null {
    const on = route.treadOf(this.plants[1 - this.swinging] ?? this.from);
    if (on >= 0) {
      const next = on + direction;
      return next >= 0 && next < route.treads ? next : -1;
    }
    if (!route.onStairs(land)) {
      return null;
    }
    return direction > 0 ? 0 : route.treads - 1;
  }

  /**
   * Punto del pie en el aire: avanza suave, alcanza su punto más alto al principio (el talón sube detrás y la
   * rodilla se dobla) y, si sube un peldaño, se eleva antes de avanzar para no tropezar.
   *
   * @param target Vector donde se escribe el punto.
   */
  private arc(target: Vector3): void {
    const { flat, stairs, rise, peak } = Footsteps.CLEAR;
    const s = this.progress;
    target.lerpVectors(this.from, this.to, Footsteps.ease(s, 0, 1));
    const lift = Footsteps.ease(Math.min(s * rise, 1), 0, 1);
    target.y = this.from.y + (this.to.y - this.from.y) * lift;
    target.y += Math.sin(Math.PI * s ** peak) * (this.climbing ? stairs : flat);
  }

  /**
   * Curva suave de 0 a 1.
   *
   * @param value Entrada.
   * @param from Inicio.
   * @param to Fin.
   * @returns Valor en [0, 1].
   */
  private static ease(value: number, from: number, to: number): number {
    const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
    return t * t * (3 - 2 * t);
  }
}
