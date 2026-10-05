import {
  CircleGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Roaming } from '@shared/engine/Roaming';
import type { DaylightAware } from '../../models/DaylightAware';
import type { StoolSeat } from '../../models/StoolSeat';
import { ShopStairs } from '../workshop/ShopStairs';
import { Chopsticks } from './Chopsticks';
import { CommuteRoute } from './CommuteRoute';
import { Figure } from './Figure';
import type { FigureLimb } from './FigureLimb';
import { Footsteps } from './Footsteps';
import { StoolApproach } from './StoolApproach';

/**
 * Juan: de noche y de tarde, en la barra, sentado en el taburete, come ramen con palillos (baja al tazón, sube
 * los fideos, mastica) y cada tanto mira el osciloscopio para revisar la respuesta del lazo de control. De día
 * el ramen cierra y él sube a trabajar al taller: se levanta, camina por la acera, rodea la escalera, la sube
 * peldaño a peldaño con la mano en el pasamanos, entra por la puerta del costado y se sienta en la mesa de los
 * cables a trabajar; al volver la tarde hace el camino al revés. Camina con pisadas reales ({@link Footsteps}):
 * la cadera sube y baja, se mece hacia el pie de apoyo y gira con cada zancada, el torso gira al revés, la cabeza
 * mira al frente y los brazos se mecen con la pierna contraria. Para sentarse se acomoda detrás del taburete, se
 * inclina, apoya las manos y baja la cadera al asiento antes de subir los pies; para levantarse hace lo mismo al
 * revés. Al cargar la escena aparece directamente donde corresponde. Cabello negro, gorra oscura con logo cian,
 * camiseta azul, jean oscuro y tenis blancos.
 */
export class Juan extends Figure implements DaylightAware, Roaming {
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
  private static readonly HALF = 0.5;
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
  private static readonly LAB_AT = 0.75;
  private static readonly BAR: StoolSeat = {
    seat: { x: 0.47, y: 0, z: 1.52 },
    heading: Math.PI,
    foot: { x: 0.13, y: 0.42, z: 0.5 },
    support: { x: 0.17, y: 1.13, z: 0.44 },
    lean: 0.16,
    look: 0,
  };
  private static readonly LAB: StoolSeat = {
    seat: { x: 1.62, y: 3.13, z: -0.55 },
    heading: -Math.PI / 2,
    foot: { x: 0.13, y: 0.17, z: 0.48 },
    support: { x: 0.15, y: 1.03, z: 0.36 },
    lean: 0.24,
    look: 0.42,
  };
  private static readonly SEATS: readonly StoolSeat[] = [Juan.BAR, Juan.LAB];
  private static readonly SIT = {
    seconds: 2.4,
    turn: 0.3,
    gather: [
      { from: 0, to: 0.18 },
      { from: 0.1, to: 0.3 },
    ],
    over: { from: 0.28, to: 0.62 },
    lower: { from: 0.4, to: 0.76 },
    bend: { amount: 0.4, from: 0.18, to: 0.8 },
    feet: [
      { from: 0.66, to: 0.84 },
      { from: 0.78, to: 0.97 },
    ],
    support: { from: 0.2, to: 0.45 },
    settle: { from: 0.66, to: 0.98 },
    lift: 0.06,
  };
  private static readonly WALK = {
    speed: 1.05,
    stairs: 0.42,
    pelvis: -0.025,
    bob: 0.024,
    sway: 0.028,
    yaw: 0.08,
    roll: 0.04,
    counter: 1.5,
    lean: 0.06,
    climb: 0.2,
    look: 0.05,
    stairsLook: 0.32,
    turn: 10,
    arrived: 0.002,
  };
  private static readonly SWING_ARM = {
    x: 0.19,
    y: 0.75,
    forward: 0.03,
    swing: 0.6,
    raise: 0.25,
    rail: 0.08,
  };
  private static readonly KNEE_POLE = { x: 0.15, y: 0.15, z: 1 };
  private static readonly ELBOW_POLE = { x: 0.3, y: -0.3, z: -1 };
  private static readonly WORK = {
    left: { x: 0.12, y: 1.03, z: 0.4 },
    right: { x: -0.1, y: 1.05, z: 0.42 },
    pole: { x: 0, y: -1, z: -0.4 },
    tinker: { speed: 2.6, reach: 0.035 },
  };
  private static readonly HAIR = { radius: 0.144, cover: 0.55, y: 0.125, z: -0.014, tilt: -0.45 };
  private static readonly CAP = {
    crown: { radius: 0.15, height: 0.8, y: 0.185, z: -0.005, tilt: -0.12 },
    brim: { radius: 0.11, thickness: 0.014, y: 0.198, z: 0.112, tilt: 0.05, width: 1.05 },
    button: { radius: 0.013 },
    badge: { radius: 0.018, y: 0.25, z: 0.121, tilt: -0.75, color: 0x3fd8ff, glow: 0.35 },
    color: 0x1b202d,
  };
  private static readonly SIDES = [1, -1];

  public readonly roaming = true;

  private chopsticks: Chopsticks | null = null;
  private readonly hand = new Vector3();
  private readonly route = new CommuteRoute();
  private readonly steps = new Footsteps();
  private readonly approach = new StoolApproach(this.route, Juan.BAR);
  private readonly spot = new Vector3();
  private readonly target = new Vector3();
  private readonly pole = new Vector3();
  private readonly mark = new Vector3();
  private readonly base = new Vector3();
  private readonly gathered = [new Vector3(), new Vector3()];
  private readonly feet = [new Vector3(), new Vector3()];
  private readonly seatedListeners: ((seated: boolean) => void)[] = [];
  private glance = 0;
  private delta = 0;
  private distance = 0;
  private direction = 1;
  private goal = 0;
  private stool: number | null = 0;
  private sit = 1;
  private entry = Math.PI;
  private heading = Math.PI;
  private started = false;
  private seated: boolean | null = null;

  /**
   * Crea a Juan.
   */
  public constructor() {
    super(Juan.OPTIONS);
  }

  /**
   * Avisa cada vez que Juan llega a la barra o se va de ella (el tazón solo está servido mientras está ahí).
   *
   * @param listener Recibe `true` si está en la barra.
   */
  public onSeated(listener: (seated: boolean) => void): void {
    this.seatedListeners.push(listener);
  }

  /**
   * De día va al taller; de tarde y de noche, a la barra. La primera vez aparece directamente ahí, sentado.
   *
   * @param level Momento del día (0 = noche, 0,5 = tarde, 1 = día).
   */
  public setDaylight(level: number): void {
    this.goal = level >= Juan.LAB_AT ? 1 : 0;
    if (!this.started) {
      this.started = true;
      this.stool = this.goal;
      this.sit = 1;
      this.distance = this.goal * this.route.length;
      this.heading = Juan.SEATS[this.goal]?.heading ?? Math.PI;
      this.entry = this.heading;
    }
  }

  /**
   * @inheritdoc
   */
  protected override dress(): void {
    this.buildHair();
    this.buildCap();
    this.chopsticks = new Chopsticks(this.joints.armRight.end, this.root);
  }

  /**
   * @inheritdoc
   */
  protected override animate(delta: number, elapsed: number): void {
    this.delta = delta;
    const seat = this.stool === null ? undefined : Juan.SEATS[this.stool];
    if (seat) {
      this.perch(seat, delta, elapsed);
    } else {
      this.stroll(delta);
    }
    this.report();
  }

  /**
   * En un taburete: se sienta o se levanta según adónde tiene que ir; al terminar de levantarse empieza a
   * caminar.
   *
   * @param seat Taburete.
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Tiempo actual.
   */
  private perch(seat: StoolSeat, delta: number, elapsed: number): void {
    const staying = this.goal === this.stool;
    const rate = delta / Juan.SIT.seconds;
    this.sit = Math.min(Math.max(this.sit + (staying ? rate : -rate), 0), 1);
    if (!staying && this.sit === 0) {
      this.depart(seat);
      this.stroll(delta);
      return;
    }
    this.poseSeat(seat, elapsed);
  }

  /**
   * Termina de levantarse: los pies quedan apoyados junto al taburete y empieza a caminar.
   *
   * @param seat Taburete del que se levantó.
   */
  private depart(seat: StoolSeat): void {
    const [left, right] = Juan.SIDES.map((side) => this.approach.touchdown(seat, side, new Vector3()));
    this.steps.place(left ?? this.spot, right ?? this.spot);
    this.direction = this.stool === 0 ? 1 : -1;
    this.stool = null;
  }

  /**
   * Camina hacia el otro taburete; al llegar, empieza a sentarse.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private stroll(delta: number): void {
    const gap = this.goal * this.route.length - this.distance;
    if (Math.abs(gap) < Juan.WALK.arrived) {
      this.arrive();
      return;
    }
    this.direction = Math.sign(gap);
    const { speed: walk, stairs } = Juan.WALK;
    const speed = walk + (stairs - walk) * this.route.climb(this.distance);
    const advance = Math.min(Math.abs(gap), speed * delta);
    this.distance += advance * this.direction;
    this.steps.advance(this.route, this.distance, this.direction, advance);
    this.poseWalk(delta);
  }

  /**
   * Llega detrás del taburete: guarda dónde quedaron los pies y hacia dónde miraba para empezar a sentarse.
   */
  private arrive(): void {
    Juan.SIDES.forEach((side, index) => {
      this.steps.foot(side, this.gathered[index] ?? this.spot);
    });
    this.entry = this.heading;
    this.stool = this.goal;
    this.sit = 0;
  }

  /**
   * Pose caminando: la raíz sigue el camino entre los dos pies con el sube y baja y el vaivén de cada paso, la
   * cadera gira con la zancada y el torso al revés, y piernas y brazos van a sus pisadas y su vaivén.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private poseWalk(delta: number): void {
    this.steer(delta);
    const stairs = this.route.onStairs(this.distance);
    const s = this.steps.stride;
    const side = this.steps.swingSide;
    const { pelvis, bob, sway } = Juan.WALK;
    const shift = -side * sway * Math.sin(Math.PI * s);
    this.root.position.set(
      this.spot.x + Math.cos(this.heading) * shift,
      this.steps.support() + pelvis + bob * Math.sin(Math.PI * s),
      this.spot.z - Math.sin(this.heading) * shift,
    );
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld();
    this.swayBody(side, s, stairs);
    this.walkLegs();
    this.walkArms(stairs);
    this.chopsticks?.follow(false, 0);
  }

  /**
   * Lleva el cuerpo al punto del camino y lo gira, suave, hacia donde avanza.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private steer(delta: number): void {
    const heading = this.route.sample(this.distance, this.spot);
    const travel = heading + (this.direction < 0 ? Math.PI : 0);
    this.heading += Juan.wrap(travel - this.heading) * (1 - Math.exp(-Juan.WALK.turn * delta));
  }

  /**
   * Cadera que gira con la pierna que avanza y se inclina hacia la que se levanta; torso que gira al revés (y se
   * inclina en la escalera) y cabeza que sigue mirando al frente.
   *
   * @param side Pie en el aire (1 izquierdo, -1 derecho, 0 ninguno).
   * @param s Avance del paso [0, 1].
   * @param stairs Si está en la escalera.
   */
  private swayBody(side: number, s: number, stairs: boolean): void {
    const { yaw, roll, counter, lean, climb, look, stairsLook } = Juan.WALK;
    const turn = side * yaw * Math.cos(Math.PI * s);
    this.joints.hips.rotation.set(0, turn, side * roll * Math.sin(Math.PI * s));
    const up = this.direction > 0;
    this.joints.torso.rotation.set(stairs && up ? climb : lean, -turn * counter, 0);
    this.joints.head.rotation.set(stairs ? stairsLook : look, turn * (counter - 1), 0);
  }

  /**
   * Cada pierna a su pisada, con el pie plano o despegando y pisando de talón.
   */
  private walkLegs(): void {
    Juan.SIDES.forEach((side, index) => {
      const foot = this.feet[index] ?? this.spot;
      this.root.worldToLocal(this.steps.foot(side, foot));
      this.reach(this.leg(side), foot, this.kneePole(side, this.mark));
      this.level(this.leg(side).end, this.steps.pitch(side));
    });
  }

  /**
   * Brazos que se mecen con la pierna contraria (el codo se dobla al ir adelante); en la escalera, la mano del
   * lado del pasamanos va deslizándose por él.
   *
   * @param stairs Si está en la escalera.
   */
  private walkArms(stairs: boolean): void {
    const { x, y, forward, swing, raise, rail } = Juan.SWING_ARM;
    Juan.SIDES.forEach((side, index) => {
      const ahead = (this.feet[1 - index]?.z ?? 0) * swing;
      this.target.set(side * x, y + Math.max(ahead, 0) * raise, forward + ahead);
      if (stairs) {
        this.holdRail(side, rail);
      }
      this.pole.set(side * Juan.ELBOW_POLE.x, Juan.ELBOW_POLE.y, Juan.ELBOW_POLE.z);
      this.reach(side > 0 ? this.joints.armLeft : this.joints.armRight, this.target, this.pole);
    });
  }

  /**
   * Si el pasamanos queda del lado de esta mano, la lleva un poco por delante del cuerpo sobre él.
   *
   * @param side Mano (1 izquierda, -1 derecha).
   * @param ahead Cuánto por delante del cuerpo.
   */
  private holdRail(side: number, ahead: number): void {
    const z = this.root.position.z + Math.cos(this.heading) * ahead;
    this.root.worldToLocal(ShopStairs.rail(z, this.mark));
    if (Math.sign(this.mark.x) === side) {
      this.target.copy(this.mark);
    }
  }

  /**
   * Pose sentándose o levantándose. Para sentarse: gira hacia la barra o la mesa mientras da dos pasitos hasta
   * dejar los pies bajo el borde del asiento, se inclina y apoya las manos, lleva la cadera sobre el asiento y
   * recién ahí la baja, y sube los pies de a uno. Para levantarse hace lo mismo al revés: baja los pies, sube la
   * cadera y después se aparta del asiento.
   *
   * @param seat Taburete.
   * @param elapsed Tiempo actual.
   */
  private poseSeat(seat: StoolSeat, elapsed: number): void {
    const t = this.sit;
    const { over, lower, turn } = Juan.SIT;
    this.heading = Juan.blendAngle(this.entry, seat.heading, Juan.ease(t, 0, turn));
    this.approach.standing(seat, this.spot);
    const across = Juan.ease(t, over.from, over.to);
    this.root.position.set(
      this.spot.x + (seat.seat.x - this.spot.x) * across,
      this.spot.y + (seat.seat.y - this.spot.y) * Juan.ease(t, lower.from, lower.to),
      this.spot.z + (seat.seat.z - this.spot.z) * across,
    );
    this.root.rotation.y = this.heading;
    this.root.updateMatrixWorld();
    const settled = Juan.ease(t, Juan.SIT.settle.from, Juan.SIT.settle.to);
    const bite = this.stool === 0 ? this.dine(settled, elapsed) : this.work(seat, settled);
    this.counterweight(t);
    this.seatLegs(seat, t);
    this.seatArms(seat, t, bite, elapsed);
    this.chopsticks?.follow(this.stool === 0 && settled > Juan.HALF, bite);
  }

  /**
   * Inclinación extra del torso mientras se sienta o se levanta (el contrapeso al bajar o subir la cadera).
   *
   * @param t Avance de la transición (0 = de pie, 1 = sentado).
   */
  private counterweight(t: number): void {
    const { amount, from, to } = Juan.SIT.bend;
    const bump = Math.sin(Math.PI * Math.min(Math.max((t - from) / (to - from), 0), 1));
    const walking = Juan.WALK.lean * (1 - Juan.ease(t, 0, Juan.SIT.turn));
    this.joints.torso.rotation.x += amount * bump + walking;
  }

  /**
   * Pies: primero dan un pasito cada uno hasta quedar bajo el borde del asiento; luego cada uno sube a su lugar
   * (el reposapiés o el piso bajo la mesa).
   *
   * @param seat Taburete.
   * @param t Avance de la transición.
   */
  private seatLegs(seat: StoolSeat, t: number): void {
    const { gather, feet, lift } = Juan.SIT;
    const sitting = this.goal === this.stool;
    Juan.SIDES.forEach((side, index) => {
      const window = feet[index] ?? { from: 0, to: 1 };
      const step = gather[index] ?? { from: 0, to: 1 };
      const touchdown = this.approach.touchdown(seat, side, this.target);
      const start = sitting ? (this.gathered[index] ?? touchdown) : touchdown;
      const foot = this.feet[index] ?? this.spot;
      this.approach.arc(this.base, start, touchdown, Juan.ease(t, step.from, step.to), lift);
      this.approach.seated(seat, side, this.mark);
      this.approach.arc(foot, this.base, this.mark, Juan.ease(t, window.from, window.to), lift);
      this.root.worldToLocal(foot);
      this.reach(this.leg(side), foot, this.kneePole(side, this.pole));
      this.level(this.leg(side).end, 0);
    });
  }

  /**
   * Manos: de los costados a apoyarse en la barra o la mesa y de ahí a su pose sentado.
   *
   * @param seat Taburete.
   * @param t Avance de la transición.
   * @param bite Cuánto está llevando fideos a la boca.
   * @param elapsed Tiempo actual.
   */
  private seatArms(seat: StoolSeat, t: number, bite: number, elapsed: number): void {
    const leaning = Juan.ease(t, Juan.SIT.support.from, Juan.SIT.support.to);
    const settled = Juan.ease(t, Juan.SIT.settle.from, Juan.SIT.settle.to);
    Juan.SIDES.forEach((side) => {
      const pose = this.seatedHand(side, bite, elapsed);
      const rest = this.target.set(side * Juan.SWING_ARM.x, Juan.SWING_ARM.y, Juan.SWING_ARM.forward);
      rest.lerp(this.mark.set(side * seat.support.x, seat.support.y, seat.support.z), leaning);
      rest.lerp(pose.hand, settled);
      this.pole.set(side * Juan.ELBOW_POLE.x, Juan.ELBOW_POLE.y, Juan.ELBOW_POLE.z).lerp(pose.elbow, settled);
      this.reach(side > 0 ? this.joints.armLeft : this.joints.armRight, rest, this.pole);
    });
  }

  /**
   * Pose de una mano ya sentado: el tazón y los palillos en la barra, o la mesa en el taller (la derecha
   * trabaja con pequeños movimientos).
   *
   * @param side Mano (1 izquierda, -1 derecha).
   * @param bite Cuánto está llevando fideos a la boca.
   * @param elapsed Tiempo actual.
   * @returns Punto de la mano y hacia dónde va el codo.
   */
  private seatedHand(side: number, bite: number, elapsed: number): { hand: Vector3; elbow: Vector3 } {
    if (this.stool === 0) {
      const hand =
        side > 0 ? new Vector3().copy(Juan.HOLD_BOWL) : Juan.mix(this.hand, Juan.DIP, Juan.LIFT, bite);
      return { hand, elbow: new Vector3().copy(side > 0 ? Juan.LEFT_POLE : Juan.RIGHT_POLE) };
    }
    const { left, right, pole, tinker } = Juan.WORK;
    const hand = new Vector3().copy(side > 0 ? left : right);
    if (side < 0) {
      hand.x += Math.sin(elapsed * tinker.speed) * tinker.reach;
    }
    return { hand, elbow: new Vector3().copy(pole) };
  }

  /**
   * Torso y cabeza en la barra: inclinado sobre el tazón, con el vistazo al osciloscopio.
   *
   * @param weight Cuánto está ya sentado comiendo [0, 1].
   * @param elapsed Tiempo actual.
   * @returns Cuánto está llevando fideos a la boca [0, 1].
   */
  private dine(weight: number, elapsed: number): number {
    const { period, start, turnIn, hold, rate, head, torso } = Juan.GLANCE;
    const cycle = elapsed % period;
    const looking =
      Juan.ease(cycle, start, start + turnIn) - Juan.ease(cycle, start + hold, start + hold + turnIn);
    this.glance += (looking - this.glance) * (1 - Math.exp(-rate * this.delta));
    const bite = this.biteAmount(elapsed) * (1 - this.glance);
    this.joints.torso.rotation.set(Juan.BAR.lean * weight, this.glance * torso * weight, 0);
    this.nod(bite, elapsed, head * weight);
    this.joints.head.rotation.x *= weight;
    return bite;
  }

  /**
   * Torso y cabeza en el taller: inclinado sobre la mesa mirando lo que arma.
   *
   * @param seat Taburete del taller.
   * @param weight Cuánto está ya sentado trabajando [0, 1].
   * @returns Sin fideos (0).
   */
  private work(seat: StoolSeat, weight: number): number {
    this.joints.torso.rotation.set(seat.lean * weight, 0, 0);
    this.joints.head.rotation.set(seat.look * weight, 0, 0);
    return 0;
  }

  /**
   * Hacia dónde se dobla una rodilla: al frente y un poco hacia afuera.
   *
   * @param side 1 = izquierda, -1 = derecha.
   * @param target Vector donde se escribe la dirección.
   * @returns El mismo vector.
   */
  private kneePole(side: number, target: Vector3): Vector3 {
    const { x, y, z } = Juan.KNEE_POLE;
    return target.set(side * x, y, z);
  }

  /**
   * Pierna de un lado.
   *
   * @param side 1 = izquierda, -1 = derecha.
   * @returns Pierna.
   */
  private leg(side: number): FigureLimb {
    return side > 0 ? this.joints.legLeft : this.joints.legRight;
  }

  /**
   * Avisa si llegó a la barra o se fue de ella.
   */
  private report(): void {
    const seated = this.stool === 0;
    if (seated !== this.seated) {
      this.seated = seated;
      this.seatedListeners.forEach((listener) => {
        listener(seated);
      });
    }
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

  /**
   * Mezcla dos ángulos por el camino más corto.
   *
   * @param from Ángulo inicial.
   * @param to Ángulo final.
   * @param t Mezcla [0, 1].
   * @returns Ángulo mezclado.
   */
  private static blendAngle(from: number, to: number, t: number): number {
    return from + Juan.wrap(to - from) * t;
  }

  /**
   * Lleva un ángulo a (-π, π].
   *
   * @param angle Ángulo.
   * @returns Ángulo equivalente.
   */
  private static wrap(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }
}
