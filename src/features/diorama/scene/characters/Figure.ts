import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { GeometryBatcher } from '@shared/engine/GeometryBatcher';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { FigureJoints } from './FigureJoints';
import type { FigureLimb } from './FigureLimb';
import type { FigureOptions } from './FigureOptions';

/**
 * Personaje hecho a mano con formas redondeadas, en el mismo estilo que el resto del puesto (patrón
 * Template Method): la base arma el cuerpo articulado (cadera, torso, cabeza, brazos y piernas de dos
 * segmentos) con una cara sencilla, y ofrece cinemática inversa de dos huesos ({@link Figure.reach}) para
 * llevar manos y pies a un punto. Cada subclase agrega ropa y accesorios en {@link Figure.dress} y se anima
 * en {@link Figure.animate}. Medidas en metros, en el espacio del personaje (+z al frente, +x a su izquierda).
 */
export abstract class Figure extends SceneObject implements Updatable {
  private static readonly LEG = {
    thigh: 0.42,
    shin: 0.4,
    spread: 0.085,
    thighRadius: 0.07,
    shinRadius: 0.056,
  };
  private static readonly FOOT = { radius: 0.048, length: 0.12, y: -0.025, z: 0.045, width: 1.05 };
  private static readonly PELVIS = { radius: 0.13, width: 1.12, height: 0.75, depth: 0.85, y: 0.02 };
  private static readonly TORSO = { length: 0.47, radius: 0.14, body: 0.2, y: 0.25, depth: 0.8 };
  private static readonly SHOULDER = { x: 0.175, y: 0.41 };
  private static readonly ARM = {
    upper: 0.27,
    lower: 0.25,
    upperRadius: 0.05,
    lowerRadius: 0.043,
    hand: 0.047,
  };
  private static readonly NECK = { radius: 0.047, height: 0.1, y: 0.49, head: 0.52 };
  private static readonly HEAD = { radius: 0.135, stretch: 1.06, y: 0.12 };
  private static readonly EYES = [{ x: -0.047 }, { x: 0.047 }];
  private static readonly EYE = {
    radius: 0.017,
    y: 0.135,
    z: 0.121,
    depth: 0.45,
    tall: 1.35,
    color: 0x16110f,
  };
  private static readonly BROW = {
    width: 0.046,
    height: 0.013,
    depth: 0.016,
    y: 0.182,
    z: 0.112,
    tilt: 0.12,
  };
  private static readonly NOSE = { radius: 0.021, y: 0.1, z: 0.13 };
  private static readonly EARS = [{ x: -0.133 }, { x: 0.133 }];
  private static readonly EAR = { radius: 0.033, y: 0.115, squash: 0.5 };
  private static readonly FINISH = { roughness: 0.8, envMapIntensity: 0.45 };
  private static readonly DOWN = new Vector3(0, -1, 0);
  private static readonly REACH_MARGIN = 0.001;

  protected readonly joints: FigureJoints;

  private readonly posable: Object3D[] = [];
  private readonly origin = new Vector3();
  private readonly current = new Vector3();
  private readonly desired = new Vector3();
  private readonly start = new Vector3();
  private readonly toward = new Vector3();
  private readonly bend = new Vector3();
  private readonly elbow = new Vector3();
  private readonly swing = new Quaternion();
  private readonly world = new Quaternion();
  private readonly parent = new Quaternion();

  /**
   * Crea el personaje.
   *
   * @param options Ubicación, alto de la cadera, contextura y colores.
   */
  public constructor(protected readonly options: FigureOptions) {
    super();
    this.joints = Figure.skeleton();
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.posable.forEach((joint) => {
      joint.quaternion.identity();
    });
    this.animate(delta, elapsed);
  }

  /**
   * Agrega ropa y accesorios sobre el cuerpo ya armado.
   */
  protected abstract dress(): void;

  /**
   * Posa el cuerpo en cada frame (las articulaciones empiezan en reposo).
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  protected abstract animate(delta: number, elapsed: number): void;

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { hips, torso, head, armLeft, armRight, legLeft, legRight } = this.joints;
    this.posable.push(hips, torso, head);
    [armLeft, armRight, legLeft, legRight].forEach((limb) => {
      this.posable.push(limb.upper, limb.lower, limb.end);
    });
    hips.position.y = this.options.hips;
    this.add(hips);
    this.buildBody();
    this.buildHead();
    this.dress();
    this.root.position.copy(this.options.placement.position);
    this.root.rotation.y = this.options.placement.rotationY;
    this.settleJoints();
  }

  /**
   * Material mate para ropa, piel o accesorios.
   *
   * @param color Color.
   * @returns Material.
   */
  protected cloth(color: number): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, ...Figure.FINISH });
  }

  /**
   * Agrega una malla a una articulación.
   *
   * @param parent Articulación o grupo padre.
   * @param geometry Geometría.
   * @param material Material.
   * @param position Posición local.
   * @returns La malla, para seguir ajustándola.
   */
  protected part(
    parent: Object3D,
    geometry: BufferGeometry,
    material: Material,
    position: Vector3Like,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(position);
    parent.add(mesh);
    return mesh;
  }

  /**
   * Casquete de esfera abierto por abajo (cabello, copa de gorra).
   *
   * @param radius Radio.
   * @param cover Fracción cubierta desde el polo superior (0.5 = media esfera).
   * @returns Geometría del casquete.
   */
  protected static shell(radius: number, cover: number): SphereGeometry {
    return new SphereGeometry(
      radius,
      GeometryDetail.High,
      GeometryDetail.Medium,
      0,
      Math.PI * 2,
      0,
      Math.PI * cover,
    );
  }

  /**
   * Cinemática inversa de dos huesos: dobla hombro y codo (o cadera y rodilla) para que la punta de la
   * extremidad llegue a un punto, con el codo hacia el lado indicado.
   *
   * @param limb Extremidad.
   * @param target Punto a alcanzar, en espacio del personaje.
   * @param pole Dirección hacia la que se dobla el codo, en espacio del personaje.
   */
  protected reach(limb: FigureLimb, target: Vector3Like, pole: Vector3Like): void {
    this.root.updateMatrixWorld(true);
    this.root.worldToLocal(limb.upper.getWorldPosition(this.start));
    const upper = limb.lower.position.length();
    const lower = limb.end.position.length();
    this.toward.copy(target).sub(this.start);
    const margin = Figure.REACH_MARGIN;
    const distance = Math.min(
      Math.max(this.toward.length(), Math.abs(upper - lower) + margin),
      upper + lower - margin,
    );
    this.toward.normalize();
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(upper * upper - along * along, 0));
    this.bend.copy(pole).addScaledVector(this.toward, -this.toward.dot(pole)).normalize();
    this.elbow.copy(this.start).addScaledVector(this.toward, along).addScaledVector(this.bend, height);
    this.aim(limb.upper, this.elbow);
    this.aim(limb.lower, target);
  }

  /**
   * Gira una articulación para que su segmento (que cuelga hacia -y) apunte a un punto.
   *
   * @param joint Articulación.
   * @param target Punto, en espacio del personaje.
   */
  protected aim(joint: Object3D, target: Vector3Like): void {
    this.root.updateMatrixWorld(true);
    joint.getWorldPosition(this.origin);
    this.current.copy(Figure.DOWN).applyQuaternion(joint.getWorldQuaternion(this.world)).normalize();
    this.root.localToWorld(this.desired.copy(target)).sub(this.origin).normalize();
    this.swing.setFromUnitVectors(this.current, this.desired);
    joint.parent?.getWorldQuaternion(this.parent).invert();
    joint.quaternion.copy(this.parent.multiply(this.swing).multiply(this.world));
  }

  /**
   * Une las mallas que cuelgan directamente de cada articulación (y de la raíz) y comparten material: entre sí
   * no se mueven, solo gira la articulación. Los grupos hijos (otras articulaciones, accesorios que se mueven)
   * quedan como están.
   */
  private settleJoints(): void {
    this.root.updateMatrixWorld(true);
    const batcher = new GeometryBatcher();
    [this.root, ...this.posable].forEach((joint) => {
      batcher.batch(
        joint,
        joint.children.filter((child) => !(child instanceof Mesh)),
      );
    });
  }

  /**
   * Cadera, torso, brazos y piernas.
   */
  private buildBody(): void {
    const { palette, girth } = this.options;
    const { hips, torso } = this.joints;
    const pelvis = Figure.PELVIS;
    const pants = this.cloth(palette.pants);
    const hip = this.part(hips, Figure.ball(pelvis.radius), pants, { x: 0, y: pelvis.y, z: 0 });
    hip.scale.set(pelvis.width * girth, pelvis.height, pelvis.depth * girth);
    const { radius, body, y, depth } = Figure.TORSO;
    const chest = this.part(torso, Figure.capsule(radius, body), this.cloth(palette.top), { x: 0, y, z: 0 });
    chest.scale.set(girth, 1, depth * girth);
    this.buildArm(this.joints.armLeft);
    this.buildArm(this.joints.armRight);
    this.buildLeg(this.joints.legLeft, pants);
    this.buildLeg(this.joints.legRight, pants);
  }

  /**
   * Brazo: manga, antebrazo y mano.
   *
   * @param arm Brazo.
   */
  private buildArm(arm: FigureLimb): void {
    const { palette } = this.options;
    const { upper, lower, upperRadius, lowerRadius, hand } = Figure.ARM;
    this.part(arm.upper, Figure.capsule(upperRadius, upper - upperRadius), this.cloth(palette.sleeve), {
      x: 0,
      y: -upper / 2,
      z: 0,
    });
    this.part(arm.lower, Figure.capsule(lowerRadius, lower - lowerRadius), this.cloth(palette.forearm), {
      x: 0,
      y: -lower / 2,
      z: 0,
    });
    this.part(arm.end, Figure.ball(hand), this.cloth(palette.skin), { x: 0, y: -hand / 2, z: 0 });
  }

  /**
   * Pierna: muslo, pantorrilla y zapato.
   *
   * @param leg Pierna.
   * @param pants Tela del pantalón.
   */
  private buildLeg(leg: FigureLimb, pants: Material): void {
    const { thigh, shin, thighRadius, shinRadius } = Figure.LEG;
    this.part(leg.upper, Figure.capsule(thighRadius, thigh - thighRadius), pants, {
      x: 0,
      y: -thigh / 2,
      z: 0,
    });
    this.part(leg.lower, Figure.capsule(shinRadius, shin - shinRadius), pants, { x: 0, y: -shin / 2, z: 0 });
    const { radius, length, y, z, width } = Figure.FOOT;
    const shoe = this.part(leg.end, Figure.capsule(radius, length), this.cloth(this.options.palette.shoes), {
      x: 0,
      y,
      z,
    });
    shoe.rotation.x = Math.PI / 2;
    shoe.scale.x = width;
  }

  /**
   * Cuello, cabeza, orejas y cara.
   */
  private buildHead(): void {
    const { head, torso } = this.joints;
    const skin = this.cloth(this.options.palette.skin);
    const neck = Figure.NECK;
    this.part(torso, new CylinderGeometry(neck.radius, neck.radius, neck.height, GeometryDetail.Low), skin, {
      x: 0,
      y: neck.y,
      z: 0,
    });
    const { radius, stretch, y } = Figure.HEAD;
    this.part(head, Figure.ball(radius), skin, { x: 0, y, z: 0 }).scale.y = stretch;
    this.part(head, Figure.ball(Figure.NOSE.radius), skin, { x: 0, y: Figure.NOSE.y, z: Figure.NOSE.z });
    Figure.EARS.forEach(({ x }) => {
      this.part(head, Figure.ball(Figure.EAR.radius), skin, { x, y: Figure.EAR.y, z: 0 }).scale.x =
        Figure.EAR.squash;
    });
    this.buildEyes();
  }

  /**
   * Ojos ovalados oscuros y cejas del color del cabello.
   */
  private buildEyes(): void {
    const { head } = this.joints;
    const eye = Figure.EYE;
    const brow = Figure.BROW;
    const iris = new MeshStandardMaterial({ color: eye.color, roughness: 0.3 });
    const hair = this.cloth(this.options.palette.hair);
    Figure.EYES.forEach(({ x }) => {
      this.part(head, Figure.ball(eye.radius), iris, { x, y: eye.y, z: eye.z }).scale.set(
        1,
        eye.tall,
        eye.depth,
      );
      const line = this.part(head, new BoxGeometry(brow.width, brow.height, brow.depth), hair, {
        x,
        y: brow.y,
        z: brow.z,
      });
      line.rotation.z = Math.sign(x) * brow.tilt;
    });
  }

  /**
   * Arma la jerarquía de articulaciones en su postura de reposo (de pie, brazos colgando).
   *
   * @returns Articulaciones.
   */
  private static skeleton(): FigureJoints {
    const hips = new Group();
    const torso = new Group();
    const head = new Group();
    head.position.y = Figure.NECK.head;
    hips.add(torso);
    torso.add(head);
    const { x, y } = Figure.SHOULDER;
    const { upper, lower } = Figure.ARM;
    const { thigh, shin, spread } = Figure.LEG;
    return {
      hips,
      torso,
      head,
      armLeft: Figure.limb(torso, { x, y, z: 0 }, upper, lower),
      armRight: Figure.limb(torso, { x: -x, y, z: 0 }, upper, lower),
      legLeft: Figure.limb(hips, { x: spread, y: 0, z: 0 }, thigh, shin),
      legRight: Figure.limb(hips, { x: -spread, y: 0, z: 0 }, thigh, shin),
    };
  }

  /**
   * Extremidad de dos segmentos colgando hacia abajo desde un punto.
   *
   * @param parent Articulación padre.
   * @param at Punto de unión en el padre.
   * @param first Largo del primer segmento.
   * @param second Largo del segundo segmento.
   * @returns Extremidad.
   */
  private static limb(parent: Object3D, at: Vector3Like, first: number, second: number): FigureLimb {
    const upper = new Group();
    const lower = new Group();
    const end = new Group();
    upper.position.copy(at);
    lower.position.y = -first;
    end.position.y = -second;
    parent.add(upper);
    upper.add(lower);
    lower.add(end);
    return { upper, lower, end };
  }

  /**
   * Cápsula vertical.
   *
   * @param radius Radio.
   * @param length Largo de la parte recta.
   * @returns Geometría.
   */
  private static capsule(radius: number, length: number): CapsuleGeometry {
    return new CapsuleGeometry(radius, Math.max(length, 0), GeometryDetail.Thin, GeometryDetail.Medium);
  }

  /**
   * Esfera suave.
   *
   * @param radius Radio.
   * @returns Geometría.
   */
  private static ball(radius: number): SphereGeometry {
    return new SphereGeometry(radius, GeometryDetail.Medium, GeometryDetail.Low);
  }
}
