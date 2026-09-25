import {
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Cautín en su base: bandeja con la esponja húmeda, el resorte donde descansa la punta y el LED de encendido.
 * Al estañar, el cautín se levanta, va hasta la punta del cable, la toca un momento y vuelve al resorte
 * (cuadros clave interpolados). El cautín se arma con la punta en el origen y el mango hacia +y.
 */
export class SolderingIron {
  private static readonly TIP = { radius: 0.0032, length: 0.022 };
  private static readonly SHAFT = { radius: 0.0036, length: 0.06, color: 0xc9ced3 };
  private static readonly HANDLE = { radius: 0.011, taper: 0.75, length: 0.11, color: 0x1f5fb8 };
  private static readonly REST_AXIS = { x: 0, y: 0.54, z: 0.84 };
  private static readonly WORK_AXIS = { x: 0.35, y: 0.8, z: 0.45 };
  private static readonly LIFT = { rest: 0.08, work: 0.04 };
  private static readonly BASE = { width: 0.1, height: 0.012, depth: 0.12, back: 0.03, color: 0x2a2d31 };
  private static readonly SPONGE = {
    width: 0.045,
    height: 0.012,
    depth: 0.04,
    x: 0.026,
    z: 0.03,
    color: 0xd9b43a,
  };
  private static readonly SPRING = {
    radius: 0.017,
    from: 0.012,
    to: 0.075,
    turns: 7,
    wire: 0.0012,
    points: 90,
  };
  private static readonly POST = { width: 0.008, depth: 0.008 };
  private static readonly LED = { size: 0.006, x: -0.035, z: 0.045, color: 0xff3b2f, glow: 4, off: 0.05 };
  private static readonly HIT = { width: 0.08, height: 0.16, depth: 0.2 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.4 };
  private static readonly UP = new Vector3(0, 1, 0);
  private static readonly APPROACH = 0.07;

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new BoxGeometry(SolderingIron.HIT.width, SolderingIron.HIT.height, SolderingIron.HIT.depth),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly iron = new Group();
  private readonly handle = new MeshStandardMaterial({
    color: SolderingIron.HANDLE.color,
    roughness: 0.5,
    envMapIntensity: 0.4,
  });
  private readonly led = new MeshBasicMaterial({ toneMapped: false });
  private readonly steel = new MeshStandardMaterial({
    color: SolderingIron.SHAFT.color,
    roughness: 0.25,
    metalness: 0.9,
    envMapIntensity: 0.6,
  });
  private readonly dark = new MeshStandardMaterial({
    color: SolderingIron.BASE.color,
    roughness: 0.55,
    metalness: 0.4,
    envMapIntensity: 0.4,
  });
  private readonly poses: { position: Vector3; rotation: Quaternion }[];
  private readonly keys: { at: number; pose: number }[];

  /**
   * Crea el cautín.
   *
   * @param spots Dónde descansa la punta (en el resorte) y dónde toca el cable.
   * @param spots.rest Punta en reposo.
   * @param spots.work Punta tocando el cobre.
   * @param touch Fracción de la animación en que toca el cobre y en que lo suelta.
   * @param touch.start Inicio del contacto.
   * @param touch.end Fin del contacto.
   */
  public constructor(
    private readonly spots: { rest: Vector3Like; work: Vector3Like },
    touch: { start: number; end: number },
  ) {
    this.poses = SolderingIron.posesFor(spots);
    const { APPROACH } = SolderingIron;
    this.keys = [
      { at: 0, pose: 0 },
      { at: touch.start / 3, pose: 1 },
      { at: touch.start - APPROACH, pose: 2 },
      { at: touch.start, pose: 3 },
      { at: touch.end, pose: 3 },
      { at: touch.end + APPROACH, pose: 2 },
      { at: 1 - touch.start / 3, pose: 1 },
      { at: 1, pose: 0 },
    ];
  }

  /**
   * Construye la base y el cautín en reposo.
   *
   * @returns Grupo del cautín y su base.
   */
  public build(): Group {
    this.buildIron();
    this.buildStand();
    this.follow(null);
    this.group.add(this.iron, this.hitArea);
    return this.group;
  }

  /**
   * Coloca el cautín según el avance del estañado, o en reposo.
   *
   * @param progress Avance de la animación (0…1), o `null` si está en su base.
   */
  public follow(progress: number | null): void {
    const t = progress ?? 0;
    const found = this.keys.findIndex((key) => key.at > t);
    const next = found < 0 ? this.keys.length - 1 : Math.max(found, 1);
    const from = this.keys[next - 1] ?? { at: 0, pose: 0 };
    const to = this.keys[next] ?? from;
    const span = Math.max(to.at - from.at, Number.EPSILON);
    const linear = Math.min(Math.max((t - from.at) / span, 0), 1);
    const eased = linear * linear * (3 - 2 * linear);
    const a = this.poses[from.pose];
    const b = this.poses[to.pose];
    if (a && b) {
      this.iron.position.lerpVectors(a.position, b.position, eased);
      this.iron.quaternion.slerpQuaternions(a.rotation, b.rotation, eased);
    }
  }

  /**
   * Brillo del LED de encendido de la base.
   *
   * @param level Brillo general (encendido de la escena).
   */
  public setPower(level: number): void {
    const { color, glow, off } = SolderingIron.LED;
    this.led.color.set(color).multiplyScalar(Math.max(level * glow, off));
  }

  /**
   * Resalta el cautín señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = SolderingIron.HIGHLIGHT;
    this.handle.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Punta cónica, vaina de acero y mango.
   */
  private buildIron(): void {
    const { TIP: tip, SHAFT: shaft, HANDLE: handle } = SolderingIron;
    const cone = new Mesh(new ConeGeometry(tip.radius, tip.length, GeometryDetail.Low), this.steel);
    cone.rotation.x = Math.PI;
    cone.position.y = tip.length / 2;
    const tube = new Mesh(
      new CylinderGeometry(shaft.radius, shaft.radius, shaft.length, GeometryDetail.Low),
      this.steel,
    );
    tube.position.y = tip.length + shaft.length / 2;
    const bottom = handle.radius * handle.taper;
    const grip = new Mesh(
      new CylinderGeometry(handle.radius, bottom, handle.length, GeometryDetail.Medium),
      this.handle,
    );
    grip.position.y = tip.length + shaft.length + handle.length / 2;
    this.iron.add(cone, tube, grip);
  }

  /**
   * Bandeja con esponja, resorte y LED.
   */
  private buildStand(): void {
    const { rest } = this.spots;
    const { BASE: base, SPONGE: sponge, LED: led } = SolderingIron;
    const floor = rest.y - SolderingIron.SPRING.radius * 2;
    const top = floor + base.height;
    const z = rest.z + base.back;
    const tray = this.box(base, this.dark, { x: rest.x, y: floor + base.height / 2, z });
    const foam = new MeshStandardMaterial({ color: sponge.color, roughness: 0.95, envMapIntensity: 0.1 });
    const pad = this.box(sponge, foam, { x: rest.x + sponge.x, y: top + sponge.height / 2, z: z + sponge.z });
    const cube = { width: led.size, height: led.size, depth: led.size };
    const lamp = this.box(cube, this.led, { x: rest.x + led.x, y: top + led.size / 2, z: z + led.z });
    this.group.add(tray, pad, lamp, this.buildSpring(), this.buildPost(top));
    this.hitArea.position.set(rest.x, floor + SolderingIron.HIT.height / 2, z);
  }

  /**
   * Resorte en espiral alrededor de la vaina.
   *
   * @returns Malla del resorte.
   */
  private buildSpring(): Mesh {
    const { radius, from, to, turns, wire, points } = SolderingIron.SPRING;
    const { axis, side, lift } = SolderingIron.frame();
    const coil = Array.from({ length: points + 1 }, (_, index) => {
      const along = index / points;
      const angle = along * turns * Math.PI * 2;
      return new Vector3()
        .copy(this.spots.rest)
        .addScaledVector(axis, from + (to - from) * along)
        .addScaledVector(side, radius * Math.cos(angle))
        .addScaledVector(lift, radius * Math.sin(angle));
    });
    const curve = new CatmullRomCurve3(coil);
    return new Mesh(new TubeGeometry(curve, points, wire, GeometryDetail.Wire), this.steel);
  }

  /**
   * Poste que sostiene el resorte sobre la bandeja.
   *
   * @param floor Altura de la cara de la bandeja.
   * @returns Malla del poste.
   */
  private buildPost(floor: number): Mesh {
    const { radius, from } = SolderingIron.SPRING;
    const { axis, lift } = SolderingIron.frame();
    const bottom = new Vector3()
      .copy(this.spots.rest)
      .addScaledVector(axis, from)
      .addScaledVector(lift, -radius);
    const { width, depth } = SolderingIron.POST;
    const size = { width, height: Math.max(bottom.y - floor, width), depth };
    return this.box(size, this.dark, { x: bottom.x, y: (bottom.y + floor) / 2, z: bottom.z });
  }

  /**
   * Caja con medidas y posición.
   *
   * @param size Medidas.
   * @param size.width Ancho.
   * @param size.height Alto.
   * @param size.depth Profundidad.
   * @param material Material.
   * @param at Centro.
   * @returns Malla.
   */
  private box(
    size: { width: number; height: number; depth: number },
    material: MeshStandardMaterial | MeshBasicMaterial,
    at: Vector3Like,
  ): Mesh {
    const mesh = new Mesh(new BoxGeometry(size.width, size.height, size.depth), material);
    mesh.position.copy(at);
    return mesh;
  }

  /**
   * Las cuatro posturas del cautín: en reposo, levantado, sobre el cable y tocándolo.
   *
   * @param spots Punta en reposo y punta en el cable.
   * @param spots.rest Punta en reposo.
   * @param spots.work Punta en el cable.
   * @returns Posturas.
   */
  private static posesFor(spots: {
    rest: Vector3Like;
    work: Vector3Like;
  }): { position: Vector3; rotation: Quaternion }[] {
    const rest = new Quaternion().setFromUnitVectors(
      SolderingIron.UP,
      new Vector3().copy(SolderingIron.REST_AXIS).normalize(),
    );
    const work = new Quaternion().setFromUnitVectors(
      SolderingIron.UP,
      new Vector3().copy(SolderingIron.WORK_AXIS).normalize(),
    );
    const { rest: up, work: hover } = SolderingIron.LIFT;
    return [
      { position: new Vector3().copy(spots.rest), rotation: rest },
      { position: new Vector3().copy(spots.rest).setY(spots.rest.y + up), rotation: rest },
      { position: new Vector3().copy(spots.work).setY(spots.work.y + hover), rotation: work },
      { position: new Vector3().copy(spots.work), rotation: work },
    ];
  }

  /**
   * Ejes del resorte: a lo largo del cautín en reposo, de lado y hacia arriba.
   *
   * @returns Ejes unitarios.
   */
  private static frame(): { axis: Vector3; side: Vector3; lift: Vector3 } {
    const axis = new Vector3().copy(SolderingIron.REST_AXIS).normalize();
    const side = new Vector3().crossVectors(axis, SolderingIron.UP).normalize();
    return { axis, side, lift: new Vector3().crossVectors(side, axis) };
  }
}
