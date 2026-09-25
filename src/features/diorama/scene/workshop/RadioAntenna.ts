import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { RadioControl } from '../../models/RadioControl';
import type { RadioHandle } from '../../models/RadioHandle';
import type { RadioState } from '../../models/RadioState';

/**
 * Antena telescópica cromada sobre una base pesada con rótula: seis tramos que se esconden uno dentro del
 * otro y salen al arrastrarla, con la bolita de la punta. La zona que recibe el puntero crece con ella. Se
 * construye con origen en el centro de la base, sobre la cubierta.
 */
export class RadioAntenna {
  private static readonly BASE = { radius: 0.028, top: 0.02, height: 0.018, color: 0x1a1c1f };
  private static readonly JOINT = { radius: 0.008, color: 0x2a2d31 };
  private static readonly SEGMENTS = [
    { radius: 0.0055 },
    { radius: 0.0048 },
    { radius: 0.0041 },
    { radius: 0.0034 },
    { radius: 0.0028 },
    { radius: 0.0022 },
  ];
  private static readonly SEGMENT = { length: 0.2, step: 0.19 };
  private static readonly TIP = { radius: 0.0045 };
  private static readonly CHROME = 0xd6dade;
  private static readonly HIT = { radius: 0.03 };
  private static readonly RATE = 9;
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };

  public readonly group = new Group();

  private readonly chrome = new MeshStandardMaterial({ roughness: 0.2, metalness: 1, envMapIntensity: 0.6 });
  private readonly segments: Mesh[] = [];
  private readonly tip: Mesh;
  private readonly hitArea: Mesh;
  private readonly handles: RadioHandle[] = [];
  private extension = 0;

  /**
   * Crea la antena.
   */
  public constructor() {
    this.chrome.color.set(RadioAntenna.CHROME);
    this.tip = new Mesh(
      new SphereGeometry(RadioAntenna.TIP.radius, GeometryDetail.Low, GeometryDetail.Low),
      this.chrome,
    );
    const geometry = new CylinderGeometry(
      RadioAntenna.HIT.radius,
      RadioAntenna.HIT.radius,
      1,
      GeometryDetail.Hitbox,
    );
    geometry.translate(0, 1 / 2, 0);
    this.hitArea = new Mesh(geometry, new MeshBasicMaterial({ visible: false }));
  }

  /**
   * Controles de la antena.
   *
   * @returns La antena (se arrastra).
   */
  public get controls(): readonly RadioHandle[] {
    return this.handles;
  }

  /**
   * Altura del arranque del primer tramo sobre la cubierta.
   *
   * @returns Metros.
   */
  private static get bottom(): number {
    return RadioAntenna.BASE.height + RadioAntenna.JOINT.radius;
  }

  /**
   * Construye la base, los tramos y la punta.
   */
  public build(): void {
    const { radius, top, height, color } = RadioAntenna.BASE;
    const dark = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
    const base = new Mesh(new CylinderGeometry(top, radius, height, GeometryDetail.Medium), dark);
    base.position.y = height / 2;
    const joint = RadioAntenna.JOINT;
    const ball = new Mesh(
      new SphereGeometry(joint.radius, GeometryDetail.Low, GeometryDetail.Low),
      new MeshStandardMaterial({ color: joint.color, roughness: 0.4, metalness: 0.6 }),
    );
    ball.position.y = height;
    this.group.add(base, ball, this.tip, this.hitArea);
    this.buildSegments();
    this.hitArea.position.y = RadioAntenna.bottom;
    this.handles.push({ id: RadioControl.Antenna, hitArea: this.hitArea, glow: this.chrome });
    this.place();
  }

  /**
   * Extiende o recoge los tramos según el estado.
   *
   * @param state Estado del receptor.
   * @param delta Segundos desde el frame anterior.
   */
  public show(state: RadioState, delta: number): void {
    const target = state.antenna;
    if (Math.abs(target - this.extension) < Number.EPSILON) {
      return;
    }
    this.extension += (target - this.extension) * Math.min(RadioAntenna.RATE * delta, 1);
    this.place();
  }

  /**
   * Resalta la antena.
   *
   * @param id Control señalado, o `null`.
   */
  public highlight(id: string | null): void {
    const { color, strength } = RadioAntenna.HIGHLIGHT;
    this.chrome.emissive.set(color).multiplyScalar(id === RadioControl.Antenna ? strength : 0);
  }

  /**
   * Punto donde entra el coaxial (al pie de la rótula).
   *
   * @returns Punto en el espacio del grupo.
   */
  public feedPoint(): Vector3 {
    return new Vector3(0, RadioAntenna.BASE.height / 2, 0);
  }

  /**
   * Tramos cromados, cada uno más delgado que el anterior.
   */
  private buildSegments(): void {
    const { length } = RadioAntenna.SEGMENT;
    RadioAntenna.SEGMENTS.forEach((segment) => {
      const geometry = new CylinderGeometry(segment.radius, segment.radius, length, GeometryDetail.Low);
      geometry.translate(0, length / 2, 0);
      const mesh = new Mesh(geometry, this.chrome);
      this.segments.push(mesh);
      this.group.add(mesh);
    });
  }

  /**
   * Coloca cada tramo según la extensión y ajusta la punta y la zona de toque.
   */
  private place(): void {
    const { length, step } = RadioAntenna.SEGMENT;
    const bottom = RadioAntenna.bottom;
    this.segments.forEach((segment, index) => {
      segment.position.y = bottom + index * step * this.extension;
    });
    const top = bottom + (this.segments.length - 1) * step * this.extension + length;
    this.tip.position.y = top;
    this.hitArea.scale.y = top - bottom;
  }
}
