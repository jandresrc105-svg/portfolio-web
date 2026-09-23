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
import { Figure } from './Figure';

/**
 * Maestro ramenero del puesto: de espaldas revuelve la olla de caldo con el cucharón y, cada cierto tiempo,
 * se voltea hacia la barra, asiente y saluda con la mano antes de volver a la olla. Chaqueta blanca con las
 * mangas recogidas, delantal índigo anudado a la cintura, hachimaki blanco con el nudo en la nuca, cabello
 * canoso y bigote.
 */
export class Chef extends Figure {
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
  private static readonly HAIR = { radius: 0.144, cover: 0.58, y: 0.125, z: -0.015, tilt: -0.4 };
  private static readonly HEADBAND = {
    band: { radius: 0.142, tube: 0.02, y: 0.165, z: -0.005, tilt: 0.12 },
    knot: { radius: 0.028, y: 0.155, z: -0.15 },
    tail: { width: 0.035, length: 0.09, thickness: 0.01, y: 0.15, z: -0.155, spread: 0.4, offset: 0.015 },
    color: 0xcfc9bd,
  };
  private static readonly MUSTACHE = [
    { x: -0.028, tilt: 1.15 },
    { x: 0.028, tilt: -1.15 },
  ];
  private static readonly WHISKER = { radius: 0.012, length: 0.03, y: 0.073, z: 0.127 };
  private static readonly APRON = { top: 0.17, bottom: 0.2, height: 0.62, y: 0.02, depth: 0.8, arc: 0.85 };
  private static readonly APRON_TIE = { radius: 0.143, tube: 0.014, y: 0.3, depth: 0.84 };
  private static readonly APRON_COLOR = 0x1d2745;
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
  private facing = 0;

  /**
   * Crea al cocinero.
   */
  public constructor() {
    super(Chef.OPTIONS);
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
    const { period, turn, back, rate, holdUntil } = Chef.ROUTINE;
    const cycle = elapsed % period;
    const wanted = cycle > turn && cycle < back ? 1 : 0;
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
    this.root.updateMatrixWorld(true);
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
    this.root.updateMatrixWorld(true);
    this.ladle.position.copy(this.root.worldToLocal(this.hand.copy(Chef.LADLE.rest)));
    this.ladle.rotation.y = Math.PI - this.root.rotation.y;
  }

  /**
   * Cabello corto y canoso.
   */
  private buildHair(): void {
    const { radius, cover, y, z, tilt } = Chef.HAIR;
    const shell = Figure.shell(radius, cover);
    const hair = this.part(this.joints.head, shell, this.cloth(this.options.palette.hair), { x: 0, y, z });
    hair.rotation.x = tilt;
  }

  /**
   * Hachimaki: banda de tela blanca alrededor de la frente, con el nudo y las dos puntas en la nuca (lo
   * primero que se ve, porque cocina de espaldas).
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
   * Delantal índigo: paño curvo que cubre el frente desde el pecho hasta los muslos, con la cinta
   * anudada alrededor de la cintura.
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
   * Cinta del delantal alrededor de la cintura.
   *
   * @param fabric Tela del delantal.
   */
  private buildApronTie(fabric: MeshStandardMaterial): void {
    const { radius, tube, y, depth } = Chef.APRON_TIE;
    const girth = this.options.girth;
    const band = this.part(
      this.joints.hips,
      new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.Curve),
      fabric,
      { x: 0, y, z: 0 },
    );
    band.rotation.x = Math.PI / 2;
    band.scale.set(girth, depth * girth, 1);
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
}
