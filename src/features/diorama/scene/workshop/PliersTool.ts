import { Group, type BufferGeometry, type MeshStandardMaterialParameters, type Object3D } from 'three';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolId } from '../../models/ToolId';
import type { ToolOutline } from '../../models/ToolOutline';
import type { ToolWallState } from '../../models/ToolWallState';
import { WallTool } from './WallTool';

/**
 * Herramienta de dos brazos cruzados en un pivote (alicates, pinzas, pelacables, crimpadora). Cuelga con las
 * mordazas hacia arriba y los mangos abiertos en V sobre una clavija bajo el pivote. Cada mitad es una
 * mordaza de acero unida al mango del lado contrario; la segunda mitad es la primera en espejo. Al
 * inspeccionarla, la apertura separa los mangos y abre las mordazas.
 */
export abstract class PliersTool extends WallTool {
  private static readonly PLATE = { depth: 0.0055 };
  private static readonly BOSS = { radius: 0.012, segments: 18 };
  private static readonly RIVET = { radius: 0.005, depth: 0.016 };
  private static readonly SHANK = { width: 0.011, start: 0.004 };
  private static readonly HOOK = [{ x: 0, y: -0.022 }];

  private readonly halves: readonly [Group, Group] = [new Group(), new Group()];

  /**
   * Crea la herramienta.
   *
   * @param id Herramienta.
   * @param spec Medidas de los mangos, color del agarre y apertura máxima.
   * @param spec.spread Medio ángulo de la V de los mangos.
   * @param spec.handle Largo del mango (desde el pivote) y radio del agarre.
   * @param spec.handle.length Largo.
   * @param spec.handle.radius Radio.
   * @param spec.grip Largo del agarre plástico (desde el final del mango).
   * @param spec.jaw Largo y ancho de la mordaza (silueta y zona de clic).
   * @param spec.jaw.length Largo.
   * @param spec.jaw.width Ancho de una mordaza.
   * @param spec.opening Giro máximo de cada mitad al abrir.
   * @param style Acabado del agarre.
   */
  public constructor(
    id: ToolId,
    private readonly spec: {
      spread: number;
      handle: { length: number; radius: number };
      grip: number;
      jaw: { length: number; width: number };
      opening: number;
    },
    private readonly style: MeshStandardMaterialParameters,
  ) {
    super(id);
  }

  /**
   * @inheritdoc
   */
  public override hooks(): readonly { x: number; y: number }[] {
    return PliersTool.HOOK;
  }

  /**
   * @inheritdoc
   */
  public override pose(state: ToolWallState): void {
    const angle = state.open * this.spec.opening;
    this.halves.forEach((half, index) => {
      half.rotation.z = PliersTool.side(index) * angle;
    });
  }

  /**
   * @inheritdoc
   */
  public outline(): readonly ToolOutline[] {
    const { spread, handle, jaw } = this.spec;
    const reach = handle.length / 2;
    const handles = [1, -1].map((side) => ({
      x: side * Math.sin(spread) * reach,
      y: -Math.cos(spread) * reach,
      width: handle.radius * 2,
      height: handle.length,
      angle: side * spread,
      round: 0.5,
    }));
    return [
      { x: 0, y: jaw.length / 2, width: jaw.width * 2, height: jaw.length, round: 0.4 },
      { x: 0, y: 0, width: PliersTool.BOSS.radius * 2, height: PliersTool.BOSS.radius * 2, round: 0.5 },
      ...handles,
    ];
  }

  /**
   * Mordaza de una mitad (a la izquierda del eje, x ≤ 0, desde el pivote hacia arriba).
   *
   * @param depth Grosor de la placa.
   * @returns Geometría de la mordaza.
   */
  protected abstract jaw(depth: number): BufferGeometry;

  /**
   * @inheritdoc
   */
  protected override moving(): Object3D[] {
    return [...this.halves];
  }

  /**
   * Detalles extra de la mitad del frente (serigrafía, muescas marcadas). Por defecto ninguno.
   *
   * @returns Objetos en el espacio de la mitad del frente.
   */
  protected details(): readonly Object3D[] {
    return [];
  }

  /**
   * @inheritdoc
   */
  protected shape(): void {
    const { depth } = PliersTool.PLATE;
    this.halves.forEach((half, index) => {
      const side = PliersTool.side(index);
      half.scale.x = side;
      half.position.z = (side * depth) / 2;
      this.half(half);
      this.body.add(half);
    });
    const details = this.details();
    if (details.length > 0) {
      this.halves[0].add(...details);
    }
    const { radius, depth: length } = PliersTool.RIVET;
    this.part(WallTool.SHAPES.disc(radius, length, PliersTool.BOSS.segments), WallTool.PALETTE.chrome);
  }

  /**
   * @inheritdoc
   */
  protected bounds(): ToolBounds {
    const { spread, handle, jaw } = this.spec;
    const bottom = -Math.cos(spread) * handle.length - handle.radius;
    const width = (Math.sin(spread) * handle.length + handle.radius) * 2;
    return { x: 0, y: (jaw.length + bottom) / 2, width, height: jaw.length - bottom };
  }

  /**
   * Arma una mitad: mordaza con su ojo del pivote, caña de acero y agarre.
   *
   * @param half Grupo de la mitad.
   */
  private half(half: Group): void {
    const { depth } = PliersTool.PLATE;
    const palette = WallTool.PALETTE;
    this.part(this.jaw(depth), palette.steel, half);
    this.part(
      WallTool.SHAPES.disc(PliersTool.BOSS.radius, depth, PliersTool.BOSS.segments),
      palette.steel,
      half,
    );
    const { spread, handle, grip } = this.spec;
    const { width, start } = PliersTool.SHANK;
    const shank = handle.length - grip;
    const bar = this.part(
      WallTool.SHAPES.plate(PliersTool.bar(width, shank - start), depth),
      palette.steel,
      half,
    );
    bar.rotation.z = spread;
    this.grip(half, shank);
  }

  /**
   * Agarre plástico al final del mango.
   *
   * @param half Grupo de la mitad.
   * @param shank Largo de la caña de acero (donde empieza el agarre).
   */
  private grip(half: Group, shank: number): void {
    const { spread, handle, grip } = this.spec;
    const cover = this.part(WallTool.SHAPES.pill(handle.radius, grip), this.style, half);
    const middle = shank + grip / 2;
    cover.position.set(Math.sin(spread) * middle, -Math.cos(spread) * middle, 0);
    cover.rotation.z = spread;
  }

  /**
   * Contorno de la caña: una barra que baja desde el pivote y se afina.
   *
   * @param width Ancho junto al pivote.
   * @param length Largo.
   * @returns Contorno.
   */
  private static bar(width: number, length: number): readonly { x: number; y: number }[] {
    const end = -PliersTool.SHANK.start - length;
    return [
      { x: -width / 2, y: 0 },
      { x: -width / 3, y: end },
      { x: width / 3, y: end },
      { x: width / 2, y: 0 },
    ];
  }

  /**
   * Lado de una mitad.
   *
   * @param index Índice de la mitad.
   * @returns 1 o -1.
   */
  private static side(index: number): number {
    return index === 0 ? 1 : -1;
  }
}
