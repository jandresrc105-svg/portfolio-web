import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  TubeGeometry,
  Vector3,
  type CanvasTexture,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Carrete de cable rojo sobre su soporte: dos tapas grises, el bobinado rojo (con las vueltas pintadas), el eje
 * sostenido por un parante trasero y la punta del cable que cuelga hasta la mesa. Gira mientras se tira cable.
 * Se construye en un grupo con origen en el eje; el eje apunta a la calle.
 */
export class WireReel {
  public static readonly COIL = { radius: 0.042, length: 0.046 };

  private static readonly FLANGE = { radius: 0.056, thickness: 0.006, color: 0x9aa1a8 };
  private static readonly AXLE = { radius: 0.006, length: 0.1, color: 0x6d747c };
  private static readonly STAND = { width: 0.03, depth: 0.008, base: 0.03, plate: 0.006, back: 0.04 };
  private static readonly LABEL = { size: 128, radius: 0.03, lift: 0.001, title: 26, detail: 16, line: 26 };
  private static readonly WINDINGS = {
    size: 64,
    lines: 16,
    thickness: 0.3,
    color: '#c8161d',
    shade: 'rgba(40,0,0,0.55)',
  };
  private static readonly HIT = { radius: 0.064, length: 0.08 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };
  private static readonly SPIN = 9;

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new CylinderGeometry(
      WireReel.HIT.radius,
      WireReel.HIT.radius,
      WireReel.HIT.length,
      GeometryDetail.Hitbox,
    ),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly spool = new Group();
  private readonly flange = new MeshStandardMaterial({
    color: WireReel.FLANGE.color,
    roughness: 0.45,
    envMapIntensity: 0.4,
  });
  private readonly coil: MeshStandardMaterial;

  /**
   * Crea el carrete.
   *
   * @param textures Pintor de texturas de canvas.
   * @param textures.windings Textura de las vueltas del bobinado.
   * @param textures.label Etiqueta de la tapa frontal.
   * @param wire Material rojo del aislante (compartido con el tramo cortado).
   */
  public constructor(
    private readonly textures: { windings: CanvasTexture; label: CanvasTexture },
    private readonly wire: MeshStandardMaterial,
  ) {
    textures.windings.wrapS = RepeatWrapping;
    this.coil = new MeshStandardMaterial({ map: textures.windings, roughness: 0.5, envMapIntensity: 0.4 });
  }

  /**
   * Pinta las vueltas del bobinado.
   *
   * @param context Contexto del canvas.
   */
  public static paintWindings(context: CanvasRenderingContext2D): void {
    const { size, lines, thickness, color, shade } = WireReel.WINDINGS;
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);
    context.fillStyle = shade;
    const step = size / lines;
    for (let line = 0; line < lines; line++) {
      context.fillRect(0, line * step, size, step * thickness);
    }
  }

  /**
   * Pinta la etiqueta de la tapa: calibre y sección del cable.
   *
   * @param context Contexto del canvas.
   */
  public static paintLabel(context: CanvasRenderingContext2D): void {
    const { size, title, detail, line } = WireReel.LABEL;
    const half = size / 2;
    context.fillStyle = '#e9e6dc';
    context.beginPath();
    context.arc(half, half, half, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#b3141a';
    context.textAlign = 'center';
    context.font = `bold ${String(title)}px sans-serif`;
    context.fillText('AWG 18', half, half);
    context.font = `${String(detail)}px sans-serif`;
    context.fillText('0,8 mm² · Cu', half, half + line);
  }

  /**
   * Construye el carrete, el soporte y la punta del cable que baja hasta la salida.
   *
   * @param exit Punto de la mesa por donde sale el cable, relativo al eje.
   * @param wireRadius Radio del cable.
   * @returns Grupo del carrete.
   */
  public build(exit: Vector3Like, wireRadius: number): Group {
    this.buildSpool();
    this.buildStand();
    this.buildLead(exit, wireRadius);
    this.hitArea.rotation.x = Math.PI / 2;
    this.group.add(this.spool, this.hitArea);
    return this.group;
  }

  /**
   * Gira el carrete mientras sale cable.
   *
   * @param delta Segundos desde el frame anterior.
   * @param pulling Si se está tirando cable.
   */
  public update(delta: number, pulling: boolean): void {
    if (pulling) {
      this.spool.rotation.z -= WireReel.SPIN * delta;
    }
  }

  /**
   * Resalta el carrete señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = WireReel.HIGHLIGHT;
    this.flange.emissive.set(color).multiplyScalar(active ? strength : 0);
    this.coil.emissive.set(color).multiplyScalar(active ? strength / 2 : 0);
  }

  /**
   * Tapas, bobinado, eje y etiqueta.
   */
  private buildSpool(): void {
    const { radius, length } = WireReel.COIL;
    const coil = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.High), this.coil);
    coil.rotation.x = Math.PI / 2;
    const flange = WireReel.FLANGE;
    const plate = new CylinderGeometry(flange.radius, flange.radius, flange.thickness, GeometryDetail.High);
    [-1, 1].forEach((side) => {
      const disc = new Mesh(plate, this.flange);
      disc.rotation.x = Math.PI / 2;
      disc.position.z = side * (length / 2 + flange.thickness / 2);
      this.spool.add(disc);
    });
    const label = WireReel.LABEL;
    const face = new Mesh(
      new CircleGeometry(label.radius, GeometryDetail.High),
      new MeshStandardMaterial({ map: this.textures.label, roughness: 0.6, envMapIntensity: 0.2 }),
    );
    face.position.z = length / 2 + flange.thickness + label.lift;
    this.spool.add(coil, face);
  }

  /**
   * Eje y parante trasero atornillado a la mesa.
   */
  private buildStand(): void {
    const { radius, length, color } = WireReel.AXLE;
    const steel = new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.8, envMapIntensity: 0.5 });
    const axle = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.Low), steel);
    axle.rotation.x = Math.PI / 2;
    const { width, depth, base, plate, back } = WireReel.STAND;
    const height = WireReel.FLANGE.radius;
    const post = new Mesh(new BoxGeometry(width, height, depth), steel);
    post.position.set(0, -height / 2, -back);
    const foot = new Mesh(new BoxGeometry(width * 2, plate, base), steel);
    foot.position.set(0, -height + plate / 2, -back);
    this.group.add(axle, post, foot);
  }

  /**
   * Punta del cable: baja del bobinado hasta la mesa y sigue hasta la salida.
   *
   * @param exit Salida del cable, relativa al eje.
   * @param radius Radio del cable.
   */
  private buildLead(exit: Vector3Like, radius: number): void {
    const bottom = new Vector3(0, -WireReel.COIL.radius, exit.z);
    const end = new Vector3().copy(exit);
    const middle = new Vector3((bottom.x + end.x) / 2, end.y, end.z);
    const curve = new CatmullRomCurve3([bottom, middle, end]);
    const tube = new Mesh(
      new TubeGeometry(curve, GeometryDetail.Thin, radius, GeometryDetail.Low),
      this.wire,
    );
    this.group.add(tube);
  }
}
