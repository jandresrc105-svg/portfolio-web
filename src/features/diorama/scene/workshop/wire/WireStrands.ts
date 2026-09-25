import {
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Hilos de cobre de la punta pelada: siete hilos (uno central y seis alrededor), cada uno hecho de tramos
 * rectos para poder curvarlo. Sueltos se abren en abanico hacia la punta; al torcerlos siguen una hélice
 * real alrededor del central y se juntan; al estañarlos pasan de cobre a plateado brillante. Si el pelacables
 * mordió el cobre, algunos hilos faltan. El eje del cable es +x: la punta está en x = 0 y la raíz en `length`.
 */
export class WireStrands {
  private static readonly STRAND = { radius: 0.0012, ring: 0.0027, outer: 6 };
  private static readonly SEGMENTS = 6;
  private static readonly FAN = { spread: 0.0065, curve: 1.6 };
  private static readonly TWIST = { turns: 1.5, tighten: 0.82 };
  private static readonly TIN = { tighten: 0.94 };
  private static readonly OVERLAP = 1.08;
  private static readonly CUT = [{ strand: 1 }, { strand: 3 }, { strand: 4 }];
  private static readonly COPPER = { color: 0xd4773b, roughness: 0.32 };
  private static readonly TINNED = { color: 0xe3e7ec, roughness: 0.14 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.4 };
  private static readonly UP = new Vector3(0, 1, 0);

  public readonly mesh: InstancedMesh;

  private readonly material = new MeshStandardMaterial({ metalness: 0.9, envMapIntensity: 0.6 });
  private readonly copper = new Color(WireStrands.COPPER.color);
  private readonly tinned = new Color(WireStrands.TINNED.color);
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly middle = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3();
  private readonly matrix = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);

  /**
   * Crea los hilos.
   *
   * @param length Largo de la punta pelada.
   */
  public constructor(private readonly length: number) {
    const count = (WireStrands.STRAND.outer + 1) * WireStrands.SEGMENTS;
    const { radius } = WireStrands.STRAND;
    const geometry = new CylinderGeometry(radius, radius, 1, GeometryDetail.Thin, 1);
    this.mesh = new InstancedMesh(geometry, this.material, count);
    this.shape({ fan: 0, twist: 0, tin: 0, cut: false });
  }

  /**
   * Da forma a los hilos y los tiñe.
   *
   * @param look Forma de la punta.
   * @param look.fan Apertura en abanico (0…1).
   * @param look.twist Torsión (0…1).
   * @param look.tin Estañado (0…1).
   * @param look.cut Si faltan hilos.
   */
  public shape(look: { fan: number; twist: number; tin: number; cut: boolean }): void {
    const strands = WireStrands.STRAND.outer + 1;
    for (let strand = 0; strand < strands; strand++) {
      const missing = look.cut && WireStrands.CUT.some((item) => item.strand === strand);
      for (let segment = 0; segment < WireStrands.SEGMENTS; segment++) {
        const index = strand * WireStrands.SEGMENTS + segment;
        this.mesh.setMatrixAt(index, missing ? this.hidden : this.segment(strand, segment, look));
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.material.color.copy(this.copper).lerp(this.tinned, look.tin);
    const { roughness } = WireStrands.COPPER;
    this.material.roughness = roughness + (WireStrands.TINNED.roughness - roughness) * look.tin;
  }

  /**
   * Resalta la punta señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    const { color, strength } = WireStrands.HIGHLIGHT;
    this.material.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Matriz de un tramo de un hilo: un cilindro entre dos puntos de su curva.
   *
   * @param strand Hilo (0 = central).
   * @param segment Tramo desde la raíz.
   * @param look Forma de la punta.
   * @param look.fan Apertura en abanico.
   * @param look.twist Torsión.
   * @param look.tin Estañado.
   * @returns Matriz del tramo.
   */
  private segment(
    strand: number,
    segment: number,
    look: { fan: number; twist: number; tin: number },
  ): Matrix4 {
    this.point(strand, segment / WireStrands.SEGMENTS, look, this.from);
    this.point(strand, (segment + 1) / WireStrands.SEGMENTS, look, this.to);
    this.middle.addVectors(this.from, this.to).multiplyScalar(0.5);
    const direction = this.to.sub(this.from);
    const span = direction.length();
    this.rotation.setFromUnitVectors(WireStrands.UP, direction.normalize());
    this.scale.set(1, span * WireStrands.OVERLAP, 1);
    return this.matrix.compose(this.middle, this.rotation, this.scale);
  }

  /**
   * Punto de un hilo a lo largo de la punta.
   *
   * @param strand Hilo (0 = central).
   * @param along Posición desde la raíz (0) hasta la punta (1).
   * @param look Forma de la punta.
   * @param look.fan Apertura en abanico.
   * @param look.twist Torsión.
   * @param look.tin Estañado.
   * @param target Vector donde se escribe el punto.
   */
  private point(
    strand: number,
    along: number,
    look: { fan: number; twist: number; tin: number },
    target: Vector3,
  ): void {
    const { ring, outer } = WireStrands.STRAND;
    const base = strand === 0 ? 0 : ring;
    const { spread, curve } = WireStrands.FAN;
    const open = base > 0 ? look.fan * spread * Math.pow(along, curve) : 0;
    const tight = base * WireStrands.TWIST.tighten * (1 - look.tin * (1 - WireStrands.TIN.tighten));
    const radius = base + open + (tight - base - open) * look.twist;
    const angle = (strand * Math.PI * 2) / outer + look.twist * WireStrands.TWIST.turns * Math.PI * 2 * along;
    target.set(this.length * (1 - along), radius * Math.cos(angle), radius * Math.sin(angle));
  }
}
