import {
  Color,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  QuadraticBezierCurve3,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Guirnalda de bombillos colgada en el frente del puesto, en dos arcos. Los bombillos titilan suavemente,
 * cada uno a su ritmo, como filamentos viejos. Un solo draw call para todos (instancias con color propio).
 */
export class StringLights extends SceneObject implements Updatable, Powerable {
  private static readonly SPANS = [
    { from: { x: -2.12, y: 2.62, z: 1.72 }, to: { x: 0, y: 2.62, z: 1.72 } },
    { from: { x: 0, y: 2.62, z: 1.72 }, to: { x: 2.12, y: 2.62, z: 1.72 } },
  ];
  private static readonly SAG = 0.2;
  private static readonly BULBS_PER_SPAN = 7;
  private static readonly BULB = { radius: 0.03, drop: 0.035 };
  private static readonly WIRE_RADIUS = 0.006;
  private static readonly COLORS = [{ color: 0xffb86b }, { color: 0xff8fb8 }, { color: 0xffd59a }];
  private static readonly GLOW = 3.2;
  private static readonly OFF_GLOW = 0.05;
  private static readonly TWINKLE = { speed: 2.3, depth: 0.22, spread: 1.7 };

  private readonly material = new MeshBasicMaterial();
  private readonly tint = new Color();
  private bulbs: InstancedMesh | null = null;
  private level = 0;

  /**
   * Crea la guirnalda.
   *
   * @param materials Materiales compartidos (cable).
   */
  public constructor(private readonly materials: MaterialLibrary) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const bulbs = this.bulbs;
    if (!bulbs) {
      return;
    }
    const { speed, depth, spread } = StringLights.TWINKLE;
    const colors = StringLights.COLORS;
    for (let index = 0; index < bulbs.count; index += 1) {
      const flicker = 1 - depth + depth * Math.sin(elapsed * speed + index * spread) ** 2;
      const glow = Math.max(this.level * StringLights.GLOW * flicker, StringLights.OFF_GLOW);
      bulbs.setColorAt(index, this.tint.set(colors[index % colors.length]?.color ?? 0).multiplyScalar(glow));
    }
    if (bulbs.instanceColor) {
      bulbs.instanceColor.needsUpdate = true;
    }
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const count = StringLights.SPANS.length * StringLights.BULBS_PER_SPAN;
    const bulb = new SphereGeometry(StringLights.BULB.radius, GeometryDetail.Low, GeometryDetail.Thin);
    const bulbs = new InstancedMesh(bulb, this.material, count);
    StringLights.SPANS.forEach((span, spanIndex) => {
      const curve = StringLights.curve(span);
      const wire = new TubeGeometry(
        curve,
        GeometryDetail.Curve,
        StringLights.WIRE_RADIUS,
        GeometryDetail.Wire,
      );
      this.add(new Mesh(wire, this.materials.cable));
      StringLights.hang(bulbs, curve, spanIndex * StringLights.BULBS_PER_SPAN);
    });
    this.bulbs = this.add(bulbs);
    this.update(0, 0);
  }

  /**
   * Cuelga los bombillos de un tramo, repartidos a lo largo del cable.
   *
   * @param bulbs Instancias de bombillos.
   * @param curve Curva del cable.
   * @param first Índice del primer bombillo del tramo.
   */
  private static hang(bulbs: InstancedMesh, curve: QuadraticBezierCurve3, first: number): void {
    const placement = new Object3D();
    for (let bulb = 0; bulb < StringLights.BULBS_PER_SPAN; bulb += 1) {
      curve.getPoint((bulb + 0.5) / StringLights.BULBS_PER_SPAN, placement.position);
      placement.position.y -= StringLights.BULB.drop;
      placement.updateMatrix();
      bulbs.setMatrixAt(first + bulb, placement.matrix);
    }
  }

  /**
   * Arco colgante entre dos puntos.
   *
   * @param span Extremos del tramo.
   * @returns Curva con la caída del cable.
   */
  private static curve(span: (typeof StringLights.SPANS)[number]): QuadraticBezierCurve3 {
    const start = new Vector3().copy(span.from);
    const end = new Vector3().copy(span.to);
    const middle = start.clone().lerp(end, 0.5);
    middle.y -= StringLights.SAG * 2;
    return new QuadraticBezierCurve3(start, middle, end);
  }
}
