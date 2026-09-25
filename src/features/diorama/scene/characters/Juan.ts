import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Vector3Like,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { Figure } from './Figure';

/**
 * Juan en la barra: sentado en el taburete, come ramen con palillos (baja al tazón, sube los fideos,
 * mastica) y cada tanto mira el osciloscopio para revisar la respuesta del lazo de control. Cabello negro,
 * gorra oscura con logo cian, camiseta azul, jean oscuro y tenis blancos.
 */
export class Juan extends Figure {
  private static readonly OPTIONS = {
    placement: { position: { x: 0.47, y: 0, z: 1.52 }, rotationY: Math.PI },
    hips: 0.8,
    girth: 1,
    palette: {
      skin: 0xf0c3a4,
      hair: 0x1a120d,
      top: 0x3f6db5,
      sleeve: 0x3f6db5,
      forearm: 0xf0c3a4,
      pants: 0x2a3552,
      shoes: 0xeeeef2,
    },
  };
  private static readonly LEAN = 0.16;
  private static readonly HALF = 0.5;
  private static readonly KNEES = [
    { side: 'legLeft', knee: { x: 0.12, y: 0.8, z: 0.42 }, foot: { x: 0.13, y: 0.42, z: 0.5 } },
    { side: 'legRight', knee: { x: -0.12, y: 0.8, z: 0.42 }, foot: { x: -0.13, y: 0.42, z: 0.5 } },
  ] as const;
  private static readonly HOLD_BOWL = { x: 0.16, y: 1.16, z: 0.47 };
  private static readonly LEFT_POLE = { x: 1, y: -0.6, z: -0.3 };
  private static readonly RIGHT_POLE = { x: -1, y: -0.8, z: -0.3 };
  private static readonly DIP = { x: -0.02, y: 1.24, z: 0.4 };
  private static readonly LIFT = { x: -0.04, y: 1.34, z: 0.22 };
  private static readonly BITE = {
    period: 5.2,
    rise: 0.3,
    top: 0.46,
    fall: 0.62,
    chew: 9,
    nod: 0.18,
    jaw: 0.25,
  };
  private static readonly GLANCE = {
    period: 13,
    start: 7.5,
    turnIn: 0.6,
    hold: 3.2,
    head: 0.8,
    torso: 0.2,
    rate: 5,
  };
  private static readonly HAIR = { radius: 0.144, cover: 0.55, y: 0.125, z: -0.014, tilt: -0.45 };
  private static readonly CAP = {
    crown: { radius: 0.15, height: 0.8, y: 0.185, z: -0.005, tilt: -0.12 },
    brim: { radius: 0.11, thickness: 0.014, y: 0.198, z: 0.112, tilt: 0.05, width: 1.05 },
    button: { radius: 0.013 },
    badge: { radius: 0.018, y: 0.25, z: 0.121, tilt: -0.75, color: 0x3fd8ff, glow: 0.35 },
    color: 0x1b202d,
  };
  private static readonly CHOPSTICK = { length: 0.22, size: 0.007, spread: 0.012, color: 0x8a5634 };
  private static readonly CHOPSTICK_GRIP = { x: 0.01, y: -0.04, z: 0, tiltX: 2.2, tiltY: 0.5, tiltZ: 0 };
  private static readonly NOODLES = {
    strands: 3,
    length: 0.14,
    radius: 0.004,
    spread: 0.01,
    color: 0xf2d27a,
  };
  private static readonly NOODLES_VISIBLE = { from: 0.08, to: 0.92 };

  private readonly chopsticks = new Group();
  private readonly noodles = new Group();
  private readonly tip = new Vector3();
  private readonly hand = new Vector3();
  private glance = 0;

  /**
   * Crea a Juan.
   */
  public constructor() {
    super(Juan.OPTIONS);
  }

  /**
   * @inheritdoc
   */
  protected override dress(): void {
    this.buildHair();
    this.buildCap();
    this.buildChopsticks();
    this.buildNoodles();
  }

  /**
   * @inheritdoc
   */
  protected override animate(delta: number, elapsed: number): void {
    const { period, start, turnIn, hold, rate, head, torso } = Juan.GLANCE;
    const cycle = elapsed % period;
    const looking =
      Juan.ease(cycle, start, start + turnIn) - Juan.ease(cycle, start + hold, start + hold + turnIn);
    this.glance += (looking - this.glance) * (1 - Math.exp(-rate * delta));
    const bite = this.biteAmount(elapsed) * (1 - this.glance);
    this.joints.torso.rotation.set(Juan.LEAN, this.glance * torso, 0);
    this.sit();
    this.reach(this.joints.armLeft, Juan.HOLD_BOWL, Juan.LEFT_POLE);
    this.reach(this.joints.armRight, Juan.mix(this.hand, Juan.DIP, Juan.LIFT, bite), Juan.RIGHT_POLE);
    this.nod(bite, elapsed, head);
    this.followChopsticks(bite);
  }

  /**
   * Muslos al frente sobre el taburete y pantorrillas colgando hasta el reposapiés.
   */
  private sit(): void {
    Juan.KNEES.forEach(({ side, knee, foot }) => {
      const leg = this.joints[side];
      this.aim(leg.upper, knee);
      this.aim(leg.lower, foot);
    });
  }

  /**
   * Cabeza hacia el tazón mientras toma fideos, con un leve masticado, o girada hacia el osciloscopio.
   *
   * @param bite Mezcla [0, 1].
   * @param elapsed Tiempo actual.
   * @param turn Giro máximo de la cabeza al mirar el osciloscopio.
   */
  private nod(bite: number, elapsed: number, turn: number): void {
    const { nod, chew, jaw } = Juan.BITE;
    const chewing = Math.max(Math.sin(elapsed * chew), 0) * nod * jaw * bite;
    const down = nod * (1 - bite) * (1 - this.glance) + chewing;
    this.joints.head.rotation.set(down, this.glance * turn, 0);
  }

  /**
   * Cuánto está subiendo los fideos a la boca en este momento.
   *
   * @param elapsed Tiempo actual.
   * @returns 0 = palillos en el tazón, 1 = en la boca.
   */
  private biteAmount(elapsed: number): number {
    const { period, rise, top, fall } = Juan.BITE;
    const phase = (elapsed % period) / period;
    return Juan.ease(phase, rise, top) - Juan.ease(phase, fall, fall + (top - rise));
  }

  /**
   * Los fideos cuelgan de la punta de los palillos mientras suben y desaparecen en la boca.
   *
   * @param bite Mezcla [0, 1].
   */
  private followChopsticks(bite: number): void {
    this.chopsticks.updateWorldMatrix(true, false);
    this.chopsticks.localToWorld(this.tip.set(0, 0, Juan.CHOPSTICK.length));
    this.root.worldToLocal(this.tip);
    this.noodles.position.copy(this.tip);
    const { from, to } = Juan.NOODLES_VISIBLE;
    this.noodles.visible = bite > from && bite < to;
  }

  /**
   * Cabello corto oscuro ceñido a la cabeza; asoma bajo la gorra por los lados y la nuca.
   */
  private buildHair(): void {
    const { radius, cover, y, z, tilt } = Juan.HAIR;
    const shell = Figure.shell(radius, cover);
    const hair = this.part(this.joints.head, shell, this.cloth(this.options.palette.hair), { x: 0, y, z });
    hair.rotation.x = tilt;
  }

  /**
   * Gorra con copa, visera, botón y logo cian.
   */
  private buildCap(): void {
    const { crown, button, color } = Juan.CAP;
    const head = this.joints.head;
    const fabric = this.cloth(color);
    const dome = Figure.shell(crown.radius, Juan.HALF);
    const cap = this.part(head, dome, fabric, { x: 0, y: crown.y, z: crown.z });
    cap.scale.y = crown.height;
    cap.rotation.x = crown.tilt;
    this.part(head, new SphereGeometry(button.radius, GeometryDetail.Low, GeometryDetail.Thin), fabric, {
      x: 0,
      y: crown.y + crown.radius * crown.height,
      z: 0,
    });
    head.add(Juan.visor(fabric), Juan.badge());
  }

  /**
   * Palillos en la mano derecha, cruzando hacia el centro como se sostienen.
   */
  private buildChopsticks(): void {
    const { length, size, spread, color } = Juan.CHOPSTICK;
    const { x, y, z, tiltX, tiltY, tiltZ } = Juan.CHOPSTICK_GRIP;
    const wood = new MeshStandardMaterial({ color, roughness: 0.5 });
    [-spread, spread].forEach((offset) => {
      const stick = new Mesh(new BoxGeometry(size, size, length).translate(0, 0, length / 2), wood);
      stick.position.x = offset;
      this.chopsticks.add(stick);
    });
    this.chopsticks.position.set(x, y, z);
    this.chopsticks.rotation.set(tiltX, tiltY, tiltZ);
    this.joints.armRight.end.add(this.chopsticks);
  }

  /**
   * Hebras de fideos que cuelgan de los palillos.
   */
  private buildNoodles(): void {
    const { strands, length, radius, spread, color } = Juan.NOODLES;
    const pieces = Array.from({ length: strands }, (_strand, index) => {
      const x = (index - (strands - 1) / 2) * spread;
      const curve = new CatmullRomCurve3([
        new Vector3(x, 0, 0),
        new Vector3(x + spread, -length / 2, spread),
        new Vector3(x, -length, 0),
      ]);
      return new TubeGeometry(curve, GeometryDetail.Low, radius, GeometryDetail.Wire);
    });
    this.noodles.add(new Mesh(mergeGeometries(pieces), new MeshStandardMaterial({ color, roughness: 0.35 })));
    pieces.forEach((piece) => {
      piece.dispose();
    });
    this.add(this.noodles);
  }

  /**
   * Visera: medio disco al frente, un poco inclinada hacia abajo.
   *
   * @param fabric Tela de la gorra.
   * @returns Malla de la visera.
   */
  private static visor(fabric: MeshStandardMaterial): Mesh {
    const { radius, thickness, y, z, tilt, width } = Juan.CAP.brim;
    const half = new CylinderGeometry(
      radius,
      radius,
      thickness,
      GeometryDetail.High,
      1,
      false,
      -Math.PI / 2,
      Math.PI,
    );
    const visor = new Mesh(half, fabric);
    visor.position.set(0, y, z);
    visor.rotation.x = tilt;
    visor.scale.x = width;
    return visor;
  }

  /**
   * Logo circular cian al frente de la gorra, a tono con los neones.
   *
   * @returns Malla del logo.
   */
  private static badge(): Mesh {
    const { radius, y, z, tilt, color, glow } = Juan.CAP.badge;
    const material = new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: glow,
      roughness: 0.4,
    });
    const badge = new Mesh(new CircleGeometry(radius, GeometryDetail.Medium), material);
    badge.position.set(0, y, z);
    badge.rotation.x = tilt;
    return badge;
  }

  /**
   * Interpola entre dos puntos.
   *
   * @param target Vector donde se escribe el resultado.
   * @param from Punto inicial.
   * @param to Punto final.
   * @param t Mezcla [0, 1].
   * @returns El mismo vector.
   */
  private static mix(target: Vector3, from: Vector3Like, to: Vector3Like, t: number): Vector3 {
    return target.set(
      from.x + (to.x - from.x) * t,
      from.y + (to.y - from.y) * t,
      from.z + (to.z - from.z) * t,
    );
  }

  /**
   * Curva suave de 0 a 1 para mezclar poses.
   *
   * @param value Entrada.
   * @param from Inicio de la subida.
   * @param to Fin de la subida.
   * @returns Valor en [0, 1].
   */
  private static ease(value: number, from: number, to: number): number {
    const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
    return t * t * (3 - 2 * t);
  }
}
