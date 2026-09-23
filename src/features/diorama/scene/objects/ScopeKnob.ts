import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  type Material,
  type Object3D,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Perilla de instrumento: cuerpo moleteado, tapa metálica y línea indicadora. Gira entre sus topes según
 * una fracción [0, 1] y, si es interactiva, muestra un anillo de luz al señalarla.
 */
export class ScopeKnob {
  private static readonly SWEEP = { turn: 0.75 };
  private static readonly CAP = { radius: 0.62, depth: 0.35 };
  private static readonly MARK = { width: 0.14, length: 0.5, depth: 0.1 };
  private static readonly SKIRT = { radius: 1.12, depth: 0.25 };
  private static readonly HALO = { radius: 1.35, tube: 0.07, color: 0x3fd8ff, dim: 0.35, lit: 1.6 };
  private static readonly MARK_COLOR = 0xf2f2f2;

  public readonly group = new Group();
  public readonly hitArea: Object3D;

  private readonly turn = new Group();
  private readonly halo = new MeshBasicMaterial({ color: ScopeKnob.HALO.color, transparent: true });
  private readonly haloMesh: Mesh | null;

  /**
   * Crea la perilla (mira hacia +z, con la base en z = 0).
   *
   * @param radius Radio.
   * @param depth Profundidad.
   * @param materials Materiales del cuerpo, la falda y la tapa.
   * @param materials.body Goma del cuerpo.
   * @param materials.cap Metal de la tapa.
   * @param interactive Si muestra el anillo de luz (perillas que el visitante puede girar).
   */
  public constructor(
    radius: number,
    depth: number,
    materials: { body: Material; cap: Material },
    interactive: boolean,
  ) {
    this.hitArea = this.buildTurningPart(radius, depth, materials);
    const { radius: skirt, depth: skirtDepth } = ScopeKnob.SKIRT;
    this.group.add(
      this.turn,
      ScopeKnob.cylinder(radius * skirt, depth * skirtDepth, GeometryDetail.Curve, materials.body),
    );
    this.haloMesh = interactive ? this.buildHalo(radius) : null;
    if (this.haloMesh) {
      this.group.add(this.haloMesh);
    }
    this.setHighlight(false);
  }

  /**
   * Gira la perilla: 0 = tope izquierdo, 1 = tope derecho (sentido horario visto de frente).
   *
   * @param fraction Posición [0, 1].
   */
  public setFraction(fraction: number): void {
    const clamped = Math.min(Math.max(fraction, 0), 1);
    const sweep = ScopeKnob.SWEEP.turn * Math.PI * 2;
    this.turn.rotation.z = sweep / 2 - clamped * sweep;
  }

  /**
   * Enciende o atenúa el anillo de luz.
   *
   * @param lit Si está señalada o se está girando.
   */
  public setHighlight(lit: boolean): void {
    const { dim, lit: bright } = ScopeKnob.HALO;
    this.halo.color.set(ScopeKnob.HALO.color).multiplyScalar(lit ? bright : dim);
    this.halo.opacity = lit ? 1 : dim;
  }

  /**
   * Muestra u oculta el anillo de luz (se apaga con el equipo).
   *
   * @param available Si la perilla responde.
   */
  public setAvailable(available: boolean): void {
    this.haloMesh?.traverse((node) => {
      node.visible = available;
    });
  }

  /**
   * Parte que gira: cuerpo moleteado, tapa metálica y línea indicadora.
   *
   * @param radius Radio.
   * @param depth Profundidad.
   * @param materials Materiales del cuerpo y la tapa.
   * @param materials.body Goma del cuerpo.
   * @param materials.cap Metal de la tapa.
   * @returns Cuerpo de la perilla (recibe el puntero).
   */
  private buildTurningPart(
    radius: number,
    depth: number,
    materials: { body: Material; cap: Material },
  ): Mesh {
    const body = ScopeKnob.cylinder(radius, depth, GeometryDetail.High, materials.body);
    body.position.z = depth / 2;
    const { radius: capRadius, depth: capDepth } = ScopeKnob.CAP;
    const cap = ScopeKnob.cylinder(radius * capRadius, depth * capDepth, GeometryDetail.High, materials.cap);
    cap.position.z = depth + (depth * capDepth) / 2;
    const { width, length, depth: markDepth } = ScopeKnob.MARK;
    const mark = new Mesh(
      new BoxGeometry(radius * width, radius * length, radius * markDepth),
      new MeshBasicMaterial({ color: ScopeKnob.MARK_COLOR }),
    );
    mark.position.set(0, radius * (1 - length / 2 - width), depth + (radius * markDepth) / 2);
    this.turn.add(body, cap, mark);
    return body;
  }

  /**
   * Anillo de luz alrededor de la base.
   *
   * @param radius Radio de la perilla.
   * @returns Malla del anillo.
   */
  private buildHalo(radius: number): Mesh {
    const { radius: size, tube } = ScopeKnob.HALO;
    return new Mesh(
      new TorusGeometry(radius * size, radius * tube, GeometryDetail.Thin, GeometryDetail.Curve),
      this.halo,
    );
  }

  /**
   * Cilindro orientado hacia +z.
   *
   * @param radius Radio.
   * @param depth Largo.
   * @param segments Lados (pocos lados dan el moleteado).
   * @param material Material.
   * @returns Malla.
   */
  private static cylinder(radius: number, depth: number, segments: number, material: Material): Mesh {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, segments), material);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }
}
