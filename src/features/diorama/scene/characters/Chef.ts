import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { ShopFixture } from '../../models/ShopFixture';
import { ClosingRoutine } from '../ClosingRoutine';
import { StallShutter } from '../objects/StallShutter';
import { Figure } from './Figure';
import { Footsteps } from './Footsteps';
import { StraightPath } from './StraightPath';

/**
 * Maestro ramenero del puesto: de espaldas revuelve la olla de caldo con el cucharón y, cada cierto tiempo,
 * se voltea hacia la barra, asiente y saluda con la mano antes de volver a la olla. Chaqueta blanca con las
 * mangas recogidas, delantal índigo anudado a la cintura, hachimaki blanco con el nudo en la nuca, cabello
 * canoso y bigote. Él mismo cierra el local de día y lo abre de tarde, siguiendo el guion de
 * {@link ClosingRoutine}: deja la olla y camina hasta la barra (con pisadas reales, {@link Footsteps}), estira los
 * brazos al frente mientras se enrolla el noren, baja la cortina tirando de la correa y vuelve a la olla a seguir
 * preparando el caldo detrás de la cortina; para abrir hace lo mismo al revés.
 */
export class Chef extends Figure implements ShopFixture {
  private static readonly OPTIONS = {
    placement: { position: { x: -0.55, y: 0, z: -0.72 }, rotationY: Math.PI },
    hips: 0.88,
    girth: 1.12,
    palette: {
      skin: 0xe2b48f,
      hair: 0x3b3a3a,
      top: 0xc8c1b4,
      sleeve: 0xc8c1b4,
      forearm: 0xe2b48f,
      pants: 0x2b2d33,
      shoes: 0x18181c,
    },
  };
  private static readonly STIR = { center: { x: 0.03, y: 1.46, z: 0.48 }, radius: 0.06, speed: 2.1 };
  private static readonly STIR_POLE = { x: -1, y: -0.6, z: -0.2 };
  private static readonly WAVE = { center: { x: -0.3, y: 1.64, z: 0.2 }, swing: 0.09, speed: 8 };
  private static readonly WAVE_POLE = { x: -1, y: -0.5, z: 0.3 };
  private static readonly COUNTER_HAND = { x: 0.26, y: 0.97, z: 0.36 };
  private static readonly HIP_HAND = { x: 0.19, y: 0.98, z: 0.06 };
  private static readonly LEFT_POLE = { x: 1, y: -0.2, z: -0.6 };
  private static readonly POSTURE = {
    lean: 0.1,
    look: 0.28,
    breath: 1.6,
    sway: 0.015,
    nod: 0.12,
    nodSpeed: 6,
  };
  private static readonly ROUTINE = { period: 16, turn: 9, back: 13.5, rate: 3.2, holdUntil: 0.5 };
  private static readonly HAIR = {
    radius: 0.147,
    cover: 0.52,
    y: 0.12,
    z: -0.006,
    tilt: -0.64,
    narrow: 0.96,
  };
  private static readonly HEADBAND = {
    band: { radius: 0.146, tube: 0.016, y: 0.168, z: -0.013, tilt: -0.29 },
    knot: { radius: 0.026, y: 0.128, z: -0.158 },
    tail: { width: 0.035, length: 0.09, thickness: 0.01, y: 0.122, z: -0.164, spread: 0.4, offset: 0.015 },
    color: 0xcfc9bd,
  };
  private static readonly MUSTACHE = [
    { x: -0.028, tilt: 1.15 },
    { x: 0.028, tilt: -1.15 },
  ];
  private static readonly WHISKER = { radius: 0.012, length: 0.03, y: 0.073, z: 0.127 };
  private static readonly APRON = { top: 0.15, bottom: 0.17, height: 0.55, y: -0.165, depth: 0.85, arc: 0.8 };
  private static readonly APRON_TIE = { radius: 0.141, tube: 0.014, y: 0.12, depth: 0.82, knot: 0.022 };
  private static readonly APRON_COLOR = 0x1d2745;
  private static readonly KITCHEN = {
    pot: { x: -0.55, y: 0, z: -0.72 },
    front: { x: StallShutter.STRAP.x, y: 0, z: 0.08 },
    ankle: 0.06,
    turn: 0.3,
  };
  private static readonly STRIDE = { pelvis: -0.03, bob: 0.02, knee: 0.15, fade: 6 };
  private static readonly REST_FOOT = { x: 0.085, y: 0.06, z: 0 };
  private static readonly ARMS = {
    rest: { x: 0.2, y: 0.8, z: 0.03 },
    swing: 0.6,
    up: { x: 0.28, y: 1.92, z: 0.72 },
    grip: { apart: 0.04, high: 2.02, low: 1.2, inset: 0.03 },
    elbow: { x: 0.3, y: -0.3, z: -1 },
  };
  private static readonly BODY = { reach: -0.12, pull: 0.18, walk: 0.04, lookUp: -0.35, lookDown: 0.15 };
  private static readonly LADLE = {
    handle: 0.32,
    radius: 0.007,
    cup: 0.045,
    color: 0xb8c0cc,
    tilt: -0.4,
    grip: 0.03,
    rest: { x: -0.49, y: 1.55, z: -1.25 },
  };

  private readonly hand = new Vector3();
  private readonly stirTarget = new Vector3();
  private readonly waveTarget = new Vector3();
  private readonly target = new Vector3();
  private readonly pole = new Vector3();
  private readonly ladle = new Group();
  private readonly closing = new ClosingRoutine();
  private readonly path = new StraightPath(Chef.KITCHEN.pot, Chef.KITCHEN.front, Chef.KITCHEN.ankle);
  private readonly steps = new Footsteps();
  private readonly spot = new Vector3();
  private readonly feet = [new Vector3(), new Vector3()];
  private facing = 0;
  private closure = 0;
  private walked: number | null = null;

  /**
   * Crea al cocinero.
   */
  public constructor() {
    super(Chef.OPTIONS);
  }

  /**
   * @inheritdoc
   */
  public setClosure(progress: number): void {
    this.closure = progress;
  }

  /**
   * @inheritdoc
   */
  protected override dress(): void {
    this.buildHair();
    this.buildHeadband();
    this.buildMustache();
    this.buildApron();
    this.buildLadle();
  }

  /**
   * @inheritdoc
   */
  protected override animate(delta: number, elapsed: number): void {
    const progress = this.closure;
    if (progress > 0 && progress < 1) {
      this.closeShop(progress);
      return;
    }
    this.walked = null;
    this.cook(delta, elapsed, progress < 1);
  }

  /**
   * En la olla: revuelve el caldo y, con el local abierto, se voltea de vez en cuando a saludar a la barra.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Tiempo actual.
   * @param open Si el local está abierto (cerrado no hay a quién saludar).
   */
  private cook(delta: number, elapsed: number, open: boolean): void {
    const { period, turn, back, rate, holdUntil } = Chef.ROUTINE;
    const cycle = elapsed % period;
    const wanted = open && cycle > turn && cycle < back ? 1 : 0;
    this.root.position.copy(Chef.KITCHEN.pot);
    this.facing += (wanted - this.facing) * (1 - Math.exp(-rate * delta));
    this.root.rotation.y = Math.PI * (1 - this.facing);
    this.pose(elapsed);
    this.moveArms(elapsed);
    if (this.facing < holdUntil) {
      this.holdLadle();
    } else {
      this.restLadle();
    }
  }

  /**
   * Cerrando (o abriendo) el local: camina entre la olla y la barra y, en la barra, enrolla el noren y baja (o
   * sube) la cortina. El cucharón queda en la olla.
   *
   * @param progress Avance del cierre (0 = abierto, 1 = cerrado).
   */
  private closeShop(progress: number): void {
    const back = this.closing.back(progress);
    const returning = back > 0;
    const travel = returning ? 1 - back : this.closing.out(progress);
    this.walkTo(travel, returning);
    this.handleShop(progress, travel);
    this.restLadle();
  }

  /**
   * Lleva el cuerpo por el camino entre la olla (0) y la barra (1): gira al arrancar y al llegar, y los pies
   * pisan de verdad mientras camina.
   *
   * @param travel Dónde está del camino [0, 1].
   * @param returning Si vuelve a la olla.
   */
  private walkTo(travel: number, returning: boolean): void {
    const { turn } = Chef.KITCHEN;
    const pathHeading = this.path.sample(travel * this.path.length, this.spot) + (returning ? Math.PI : 0);
    const gone = returning ? 1 - travel : travel;
    const start = returning ? 0 : Math.PI;
    const end = returning ? Math.PI : 0;
    const leaving = Chef.blendAngle(start, pathHeading, Chef.ease(gone, 0, turn));
    this.root.rotation.y = Chef.blendAngle(leaving, end, Chef.ease(gone, 1 - turn, 1));
    const weight = Math.min(Math.max(Math.min(travel, 1 - travel) * Chef.STRIDE.fade, 0), 1);
    if (weight === 0) {
      this.root.position.copy(this.spot);
      this.walked = null;
      return;
    }
    this.stride(travel * this.path.length, returning ? -1 : 1, weight);
  }

  /**
   * Un tramo de caminata: avanza las pisadas lo que avanzó el cuerpo, ubica la cadera entre los pies (con el sube y
   * baja de cada paso) y lleva cada pierna a su pisada.
   *
   * @param distance Metros recorridos desde la olla.
   * @param direction 1 hacia la barra, -1 hacia la olla.
   * @param weight Cuánto está caminando [0, 1] (se desvanece al arrancar y al llegar).
   */
  private stride(distance: number, direction: number, weight: number): void {
    if (this.walked === null) {
      this.plantFeet();
      this.walked = distance;
    }
    this.steps.advance(this.path, distance, direction, Math.abs(distance - this.walked));
    this.walked = distance;
    const { pelvis, bob } = Chef.STRIDE;
    const lift = pelvis + bob * Math.sin(Math.PI * this.steps.stride);
    this.root.position.set(
      this.spot.x,
      this.steps.support() - Chef.KITCHEN.ankle + lift * weight,
      this.spot.z,
    );
    this.root.updateMatrixWorld();
    [1, -1].forEach((side, index) => {
      this.stepLeg(side, index, weight);
    });
  }

  /**
   * Apoya los dos pies donde están parados, para empezar a caminar.
   */
  private plantFeet(): void {
    this.root.position.copy(this.spot);
    this.root.updateMatrixWorld();
    const [left, right] = [1, -1].map((side) => this.root.localToWorld(this.restFoot(side, new Vector3())));
    this.steps.place(left ?? this.spot, right ?? this.spot);
  }

  /**
   * Lleva una pierna a su pisada (de a poco desde la pierna derecha y quieta al arrancar y al llegar).
   *
   * @param side 1 = izquierda, -1 = derecha.
   * @param index Posición del pie.
   * @param weight Cuánto está caminando [0, 1].
   */
  private stepLeg(side: number, index: number, weight: number): void {
    const leg = side > 0 ? this.joints.legLeft : this.joints.legRight;
    const foot = this.root.worldToLocal(this.steps.foot(side, this.feet[index] ?? this.spot));
    foot.lerp(this.restFoot(side, this.target), 1 - weight);
    const { knee } = Chef.STRIDE;
    this.reach(leg, foot, this.pole.set(side * knee, knee, 1));
    this.level(leg.end, this.steps.pitch(side) * weight);
  }

  /**
   * Manos y torso: los brazos se mecen al caminar; en la barra suben al frente mientras se enrolla el noren y
   * toman la correa de la cortina para bajarla (o la empujan para subirla).
   *
   * @param progress Avance del cierre.
   * @param travel Dónde está del camino [0, 1].
   */
  private handleShop(progress: number, travel: number): void {
    const reaching = this.closing.hands(progress, 'noren');
    const pulling = this.closing.hands(progress, 'pull');
    const walking = travel > 0 && travel < 1 ? 1 : 0;
    const { reach, pull, walk, lookUp, lookDown } = Chef.BODY;
    this.joints.torso.rotation.x = reach * reaching + pull * pulling + walk * walking;
    this.joints.head.rotation.x = lookUp * reaching + lookDown * pulling;
    const barY = StallShutter.barHeight(this.closing.pull(progress));
    [1, -1].forEach((side, index) => {
      this.handTarget(side, (walking * ((this.feet[1 - index]?.z ?? 0) - (this.feet[index]?.z ?? 0))) / 2);
      this.target.lerp(this.spot.set(side * Chef.ARMS.up.x, Chef.ARMS.up.y, Chef.ARMS.up.z), reaching);
      this.target.lerp(this.strap(side, barY, this.spot), pulling);
      this.pole.set(side * Chef.ARMS.elbow.x, Chef.ARMS.elbow.y, Chef.ARMS.elbow.z);
      this.reach(side > 0 ? this.joints.armLeft : this.joints.armRight, this.target, this.pole);
    });
  }

  /**
   * Mano colgando a un costado, mecida al revés que la pierna de su lado mientras camina.
   *
   * @param side 1 = izquierda, -1 = derecha.
   * @param swing Cuánto va adelante la pierna contraria.
   */
  private handTarget(side: number, swing: number): void {
    const { rest } = Chef.ARMS;
    this.target.set(side * rest.x, rest.y, rest.z + swing * Chef.ARMS.swing);
  }

  /**
   * Dónde toma la correa una mano (en el espacio del cocinero): del extremo de la correa mientras la cortina está
   * alta y, cuando baja, de más arriba, sin pasar por debajo de la cintura.
   *
   * @param side 1 = izquierda, -1 = derecha.
   * @param barY Altura de la barra de la cortina.
   * @param target Vector donde se escribe el punto.
   * @returns El mismo vector.
   */
  private strap(side: number, barY: number, target: Vector3): Vector3 {
    const { x, z, length } = StallShutter.STRAP;
    const { apart, high, low, inset } = Chef.ARMS.grip;
    const y = Math.min(Math.max(barY - length, low), high);
    return this.root.worldToLocal(target.set(x + side * apart, y, z - inset));
  }

  /**
   * Tobillo de pie, sin caminar (pierna derecha bajo la cadera).
   *
   * @param side 1 = izquierdo, -1 = derecho.
   * @param target Vector donde se escribe el punto (en el espacio del cocinero).
   * @returns El mismo vector.
   */
  private restFoot(side: number, target: Vector3): Vector3 {
    const { x, y, z } = Chef.REST_FOOT;
    return target.set(side * x, y, z);
  }

  /**
   * Torso levemente inclinado hacia la olla con una respiración suave; la cabeza mira el caldo o asiente
   * hacia la barra.
   *
   * @param elapsed Tiempo actual.
   */
  private pose(elapsed: number): void {
    const { lean, look, breath, sway, nod, nodSpeed } = Chef.POSTURE;
    const breathing = Math.sin(elapsed * breath) * sway;
    this.joints.torso.rotation.x = lean * (1 - this.facing) + breathing;
    const nodding = Math.max(Math.sin(elapsed * nodSpeed), 0) * nod * this.facing;
    this.joints.head.rotation.x = look * (1 - this.facing) + nodding;
  }

  /**
   * Mano derecha entre revolver la olla y saludar (según hacia dónde mira), y la izquierda entre el mesón
   * y la cintura.
   *
   * @param elapsed Tiempo actual.
   */
  private moveArms(elapsed: number): void {
    const { center, radius, speed } = Chef.STIR;
    const angle = elapsed * speed;
    this.stirTarget.set(center.x + Math.cos(angle) * radius, center.y, center.z + Math.sin(angle) * radius);
    const wave = Chef.WAVE;
    this.waveTarget.set(
      wave.center.x + Math.sin(elapsed * wave.speed) * wave.swing,
      wave.center.y,
      wave.center.z,
    );
    this.target.lerpVectors(this.stirTarget, this.waveTarget, this.facing);
    Chef.mix(this.pole, Chef.STIR_POLE, Chef.WAVE_POLE, this.facing);
    this.reach(this.joints.armRight, this.target, this.pole);
    Chef.mix(this.target, Chef.COUNTER_HAND, Chef.HIP_HAND, this.facing);
    this.reach(this.joints.armLeft, this.target, Chef.LEFT_POLE);
  }

  /**
   * Lleva el cucharón en la mano derecha, con el mango hacia arriba y la copa dentro de la olla.
   */
  private holdLadle(): void {
    this.root.updateMatrixWorld();
    this.joints.armRight.end.getWorldPosition(this.hand);
    this.root.worldToLocal(this.hand);
    this.hand.y += Chef.LADLE.grip;
    this.ladle.position.copy(this.hand);
    this.ladle.rotation.y = 0;
  }

  /**
   * Deja el cucharón apoyado dentro de la olla (posición fija en el mundo) mientras el cocinero saluda.
   */
  private restLadle(): void {
    this.root.updateMatrixWorld();
    this.ladle.position.copy(this.root.worldToLocal(this.hand.copy(Chef.LADLE.rest)));
    this.ladle.rotation.y = Math.PI - this.root.rotation.y;
  }

  /**
   * Cabello corto y canoso: casquete algo más grande que la cabeza (para que no la atraviese), inclinado hacia
   * atrás para dejar la frente libre y bajar hasta la nuca, y un poco más angosto a los lados para que se vean
   * las orejas.
   */
  private buildHair(): void {
    const { radius, cover, y, z, tilt, narrow } = Chef.HAIR;
    const shell = Figure.shell(radius, cover);
    const hair = this.part(this.joints.head, shell, this.cloth(this.options.palette.hair), { x: 0, y, z });
    hair.rotation.x = tilt;
    hair.scale.x = narrow;
  }

  /**
   * Hachimaki: banda de tela blanca ceñida sobre el cabello, más alta en la frente que en la nuca, con el nudo
   * y las dos puntas atrás (lo primero que se ve, porque cocina de espaldas).
   */
  private buildHeadband(): void {
    const { band, knot, color } = Chef.HEADBAND;
    const head = this.joints.head;
    const cloth = this.cloth(color);
    const ring = this.part(
      head,
      new TorusGeometry(band.radius, band.tube, GeometryDetail.Thin, GeometryDetail.Curve),
      cloth,
      { x: 0, y: band.y, z: band.z },
    );
    ring.rotation.x = Math.PI / 2 + band.tilt;
    this.part(head, new SphereGeometry(knot.radius, GeometryDetail.Low, GeometryDetail.Thin), cloth, {
      x: 0,
      y: knot.y,
      z: knot.z,
    });
    head.add(...Chef.headbandTails(cloth));
  }

  /**
   * Bigote en dos mechones bajo la nariz.
   */
  private buildMustache(): void {
    const { radius, length, y, z } = Chef.WHISKER;
    const hair = this.cloth(this.options.palette.hair);
    Chef.MUSTACHE.forEach(({ x, tilt }) => {
      const whisker = this.part(
        this.joints.head,
        new CapsuleGeometry(radius, length, GeometryDetail.Thin, GeometryDetail.Low),
        hair,
        { x, y, z },
      );
      whisker.rotation.z = tilt;
    });
  }

  /**
   * Delantal índigo (maekake): paño curvo que cubre el frente desde la cintura hasta las rodillas, con la
   * cinta anudada alrededor de la cintura. Arranca bajo el pecho para que el torso, al inclinarse, no lo
   * atraviese.
   */
  private buildApron(): void {
    const { top, bottom, height, y, depth, arc } = Chef.APRON;
    const girth = this.options.girth;
    const fabric = new MeshStandardMaterial({ color: Chef.APRON_COLOR, roughness: 0.9, side: DoubleSide });
    const panel = new CylinderGeometry(
      top,
      bottom,
      height,
      GeometryDetail.High,
      1,
      true,
      (-Math.PI * arc) / 2,
      Math.PI * arc,
    );
    this.part(this.joints.hips, panel, fabric, { x: 0, y, z: 0 }).scale.set(girth, 1, depth * girth);
    this.buildApronTie(fabric);
  }

  /**
   * Cinta del delantal ceñida a la cintura, con el nudo en la espalda. Va en el torso para seguirlo cuando se
   * inclina o respira; adelante queda tapada por el borde del delantal.
   *
   * @param fabric Tela del delantal.
   */
  private buildApronTie(fabric: MeshStandardMaterial): void {
    const { radius, tube, y, depth, knot } = Chef.APRON_TIE;
    const girth = this.options.girth;
    const torso = this.joints.torso;
    const band = this.part(
      torso,
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Curve),
      fabric,
      { x: 0, y, z: 0 },
    );
    band.rotation.x = Math.PI / 2;
    band.scale.set(girth, depth * girth, 1);
    const back = -radius * depth * girth;
    this.part(torso, new SphereGeometry(knot, GeometryDetail.Low, GeometryDetail.Thin), fabric, {
      x: 0,
      y,
      z: back,
    });
  }

  /**
   * Cucharón de metal: mango hacia abajo y copa al final, levemente inclinado. Vive en el espacio del
   * personaje (no en la mano) para que siempre apunte hacia la olla, sin depender del giro del brazo.
   */
  private buildLadle(): void {
    const { handle, radius, cup, color, tilt } = Chef.LADLE;
    const metal = new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.8 });
    const stick = new Mesh(new CylinderGeometry(radius, radius, handle, GeometryDetail.Thin), metal);
    stick.position.y = -handle / 2;
    const bowl = new Mesh(Chef.cup(cup), metal);
    bowl.position.y = -handle;
    this.ladle.add(stick, bowl);
    this.ladle.rotation.x = tilt;
    this.add(this.ladle);
  }

  /**
   * Las dos puntas del hachimaki, abiertas en V desde el nudo.
   *
   * @param cloth Tela del hachimaki.
   * @returns Mallas de las puntas.
   */
  private static headbandTails(cloth: MeshStandardMaterial): Mesh[] {
    const { width, length, thickness, y, z, spread, offset } = Chef.HEADBAND.tail;
    return [-1, 1].map((side) => {
      const tail = new Mesh(new BoxGeometry(width, length, thickness).translate(0, -length / 2, 0), cloth);
      tail.position.set(side * offset, y, z);
      tail.rotation.z = side * spread;
      return tail;
    });
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
   * Copa del cucharón: media esfera abierta hacia arriba.
   *
   * @param radius Radio de la copa.
   * @returns Geometría de la copa.
   */
  private static cup(radius: number): SphereGeometry {
    return new SphereGeometry(
      radius,
      GeometryDetail.Low,
      GeometryDetail.Thin,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2,
    );
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
    return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
  }

  /**
   * Curva suave de 0 a 1.
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
