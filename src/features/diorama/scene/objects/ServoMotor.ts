import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type CanvasTexture,
  type Material,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Planta del lazo: motor de corriente continua con reductora y encoder, montado en una escuadra de aluminio.
 * Al frente tiene un dial impreso de -90° a +90° y una aguja en el eje que sigue la posición del motor,
 * así el giro se ve igual que la traza amarilla del osciloscopio. El eje del motor apunta hacia +z.
 */
export class ServoMotor {
  private static readonly CAN = { radius: 0.012, length: 0.03, color: 0xb4b9c1 };
  private static readonly END_CAP = { length: 0.005, color: 0x16171a };
  private static readonly ENCODER = { radius: 0.0105, thickness: 0.0012, color: 0x0f5a36 };
  private static readonly GEARBOX = { radius: 0.0125, length: 0.012, color: 0xb08d57 };
  private static readonly SHAFT = { radius: 0.0015, length: 0.009 };
  private static readonly AXIS_HEIGHT = 0.02;
  private static readonly BRACKET = {
    width: 0.042,
    height: 0.042,
    thickness: 0.002,
    base: 0.03,
    color: 0x9aa3ad,
  };
  private static readonly DIAL = { radius: 0.019, canvas: 256, ticks: 13, major: 3, sweep: 0.5 };
  private static readonly DIAL_INK = { face: '#f1f1ec', tick: '#1b1c20', accent: '#e8412c' };
  private static readonly NEEDLE = {
    length: 0.016,
    width: 0.0018,
    depth: 0.0008,
    hub: 0.0026,
    color: 0xe8412c,
  };
  private static readonly WIRES = [
    { x: -0.004, color: 0xc0282d },
    { x: 0.004, color: 0x141416 },
  ];
  private static readonly TICK = {
    outer: 0.92,
    majorInner: 0.62,
    minorInner: 0.76,
    majorWidth: 9,
    minorWidth: 5,
  };
  private static readonly LAYER = 0.0006;

  public readonly group = new Group();
  public readonly dial: CanvasTexture;

  private readonly needle = new Group();
  private readonly metal = new MeshStandardMaterial({
    color: ServoMotor.CAN.color,
    roughness: 0.35,
    metalness: 0.85,
  });

  /**
   * Crea el motor.
   *
   * @param textures Fábrica de texturas (para el dial; quien crea el motor libera {@link ServoMotor.dial}).
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    this.dial = this.paintDial();
    this.buildBody();
    this.buildBracket();
    this.buildDial();
  }

  /**
   * Punto trasero del motor de donde salen los cables, en el espacio del grupo.
   *
   * @returns Posición.
   */
  public get wireExit(): { x: number; y: number; z: number } {
    const back = -ServoMotor.CAN.length / 2 - ServoMotor.END_CAP.length;
    return { x: 0, y: ServoMotor.AXIS_HEIGHT, z: back };
  }

  /**
   * Colores de los dos cables del motor (rojo y negro), con su separación lateral.
   *
   * @returns Cables.
   */
  public get wires(): readonly { x: number; color: number }[] {
    return ServoMotor.WIRES;
  }

  /**
   * Gira la aguja.
   *
   * @param angle Ángulo en radianes (positivo = horario visto de frente).
   */
  public setAngle(angle: number): void {
    this.needle.rotation.z = -angle;
  }

  /**
   * Lata del motor, tapa trasera con el encoder, reductora y eje.
   */
  private buildBody(): void {
    const { radius, length } = ServoMotor.CAN;
    const cap = ServoMotor.END_CAP;
    const encoder = ServoMotor.ENCODER;
    this.axial(radius, length, this.metal, 0);
    this.axial(radius, cap.length, ServoMotor.matte(cap.color), -length / 2 - cap.length / 2);
    this.axial(
      encoder.radius,
      encoder.thickness,
      ServoMotor.matte(encoder.color),
      -length / 2 - cap.length - encoder.thickness / 2,
    );
    const gear = ServoMotor.GEARBOX;
    const brass = new MeshStandardMaterial({ color: gear.color, roughness: 0.35, metalness: 0.8 });
    this.axial(gear.radius, gear.length, brass, length / 2 + gear.length / 2);
    const shaft = ServoMotor.SHAFT;
    this.axial(shaft.radius, shaft.length, this.metal, length / 2 + gear.length + shaft.length / 2);
  }

  /**
   * Escuadra de aluminio: base sobre la barra y placa vertical que sostiene la reductora.
   */
  private buildBracket(): void {
    const { width, height, thickness, base, color } = ServoMotor.BRACKET;
    const aluminium = new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.7 });
    const front = ServoMotor.CAN.length / 2 + ServoMotor.GEARBOX.length;
    const plate = new Mesh(new BoxGeometry(width, height, thickness), aluminium);
    plate.position.set(0, height / 2, front + thickness / 2);
    const floor = new Mesh(new BoxGeometry(width, thickness, base), aluminium);
    floor.position.set(0, thickness / 2, front - base / 2);
    this.group.add(plate, floor);
  }

  /**
   * Dial impreso sobre la escuadra y aguja roja en el eje.
   */
  private buildDial(): void {
    const { radius } = ServoMotor.DIAL;
    const front = ServoMotor.CAN.length / 2 + ServoMotor.GEARBOX.length + ServoMotor.BRACKET.thickness;
    const face = new Mesh(
      new CircleGeometry(radius, GeometryDetail.Curve),
      new MeshBasicMaterial({ map: this.dial }),
    );
    face.position.set(0, ServoMotor.AXIS_HEIGHT, front + ServoMotor.LAYER);
    const { length, width, depth, hub, color } = ServoMotor.NEEDLE;
    const red = new MeshStandardMaterial({ color, roughness: 0.4 });
    const arm = new Mesh(new BoxGeometry(width, length, depth).translate(0, length / 2, 0), red);
    const cap = new Mesh(new CylinderGeometry(hub, hub, depth * 2, GeometryDetail.Medium), this.metal);
    cap.rotation.x = Math.PI / 2;
    this.needle.add(arm, cap);
    this.needle.position.set(0, ServoMotor.AXIS_HEIGHT, front + ServoMotor.LAYER * 2 + depth);
    this.group.add(face, this.needle);
  }

  /**
   * Dial: marcas cada 15° entre -90° y +90°, más gruesas cada 45°, y el cero en rojo.
   *
   * @returns Textura del dial.
   */
  private paintDial(): CanvasTexture {
    const { canvas, ticks, major, sweep } = ServoMotor.DIAL;
    const { face, tick, accent } = ServoMotor.DIAL_INK;
    return this.textures.paint(canvas, canvas, (context) => {
      const center = canvas / 2;
      context.fillStyle = face;
      context.beginPath();
      context.arc(center, center, center, 0, Math.PI * 2);
      context.fill();
      context.lineCap = 'round';
      for (let index = 0; index < ticks; index += 1) {
        const angle = -Math.PI * sweep + (index / (ticks - 1)) * Math.PI * sweep * 2;
        const isMajor = index % major === 0;
        const zero = index === (ticks - 1) / 2;
        ServoMotor.tick(context, { center, angle, major: isMajor, color: zero ? accent : tick });
      }
    });
  }

  /**
   * Agrega una pieza cilíndrica acostada sobre el eje del motor.
   *
   * @param radius Radio.
   * @param length Largo a lo largo del eje.
   * @param material Material.
   * @param z Centro a lo largo del eje.
   */
  private axial(radius: number, length: number, material: Material, z: number): void {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.Curve), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(0, ServoMotor.AXIS_HEIGHT, z);
    this.group.add(mesh);
  }

  /**
   * Material mate (plástico o placa).
   *
   * @param color Color.
   * @returns Material.
   */
  private static matte(color: number): MeshStandardMaterial {
    return new MeshStandardMaterial({ color, roughness: 0.6 });
  }

  /**
   * Marca radial del dial (0 rad = arriba, positivo = horario).
   *
   * @param context Contexto 2D.
   * @param mark Centro, ángulo, si es mayor y color.
   * @param mark.center Centro del dial en píxeles.
   * @param mark.angle Ángulo.
   * @param mark.major Si es una marca mayor.
   * @param mark.color Color.
   */
  private static tick(
    context: CanvasRenderingContext2D,
    mark: { center: number; angle: number; major: boolean; color: string },
  ): void {
    const { center, angle, major, color } = mark;
    const outer = center * ServoMotor.TICK.outer;
    const inner = center * (major ? ServoMotor.TICK.majorInner : ServoMotor.TICK.minorInner);
    context.strokeStyle = color;
    context.lineWidth = major ? ServoMotor.TICK.majorWidth : ServoMotor.TICK.minorWidth;
    context.beginPath();
    context.moveTo(center + Math.sin(angle) * inner, center - Math.cos(angle) * inner);
    context.lineTo(center + Math.sin(angle) * outer, center - Math.cos(angle) * outer);
    context.stroke();
  }
}
