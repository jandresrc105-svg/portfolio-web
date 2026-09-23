import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Material,
  type Object3D,
  type Texture,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { BenchState } from '../../models/BenchState';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { BenchCable } from './BenchCable';
import { BenchDisplays } from './BenchDisplays';
import { BenchGear } from './BenchGear';
import { BenchSupply } from './BenchSupply';
import { MagnifierLamp } from './MagnifierLamp';
import { ProjectBoard } from './ProjectBoard';
import { WorkshopArt } from './WorkshopArt';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Banco de pruebas del taller, la sección de proyectos: mesa con tapete antiestático, fuente de laboratorio
 * cableada al punto de prueba, lámpara de lupa, estación de soldadura, multímetro, protoboard con un 555 y
 * las placas de los proyectos colgadas en el tablero perforado. La placa elegida baja al banco y, con la
 * fuente encendida, la fuente marca su consumo, el multímetro su tensión y sus LEDs corren.
 */
export class Workbench extends SceneObject implements Updatable, Powerable {
  private static readonly CAPACITY = 4;
  private static readonly FINISH = {
    mat: { color: 0x2c5a66, roughness: 0.92, metalness: 0, envMapIntensity: 0.3 },
    stand: { color: 0x1b1d20, roughness: 0.6 },
  };
  private static readonly LEGS = [
    { x: -1, z: -1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: 1, z: 1 },
  ];
  private static readonly LEG = { size: 0.045, inset: 0.05 };
  private static readonly LOWER_SHELF = { height: 0.025, y: 0.22, inset: 0.05 };
  private static readonly MAT = { inset: 0.05, lift: 0.001 };
  private static readonly SUPPLY = { inset: 0.01 };
  private static readonly RISER_BOARD = { thickness: 0.025, leg: 0.025 };
  private static readonly LAMP = {
    base: { x: 0.1, z: -0.86 },
    elbow: { x: 0.12, y: 1.34, z: -0.82 },
    head: { x: 0.34, y: 1.22, z: -0.5 },
  };
  private static readonly STAND = { width: 0.3, depth: 0.03, back: 0.085 };
  private static readonly BOARD_LIFT = 0.052;
  private static readonly HANG = {
    columns: [{ x: 0.36 }, { x: 0.84 }],
    rows: [{ y: 2.04 }, { y: 1.64 }],
    gap: 0.012,
  };
  private static readonly PEG = { radius: 0.004, length: 0.04, spread: 0.1, above: 0.11 };
  private static readonly CABLES = [
    { color: 0xd02a2a, end: { x: -0.15, z: -0.16 } },
    { color: 0x16181b, end: { x: -0.15, z: -0.24 } },
  ];
  private static readonly CABLE = {
    radius: 0.004,
    clip: 0.03,
    edge: { x: 0.03, drop: 0.06, out: 0.05 },
    rest: -0.5,
  };
  private static readonly RIPPLE = { amount: 0.015, speed: 7.3, refresh: 0.2 };

  private readonly art: WorkshopArt;
  private readonly layout = new WorkshopLayout();
  private readonly cables = new BenchCable();
  private readonly supply: BenchSupply;
  private readonly lamp: MagnifierLamp;
  private readonly gear: BenchGear;
  private readonly boards: ProjectBoard[];
  private readonly pegs: Mesh[] = [];
  private readonly faces: Texture[] = [];
  private readonly pieces = new Map<string, (active: boolean) => void>();
  private state: BenchState = { boards: [], selected: 0, supply: false, lamp: false, volts: 0, amps: 0 };
  private labels: readonly string[] = [];
  private level = 0;
  private refreshAt = 0;

  /**
   * Crea el banco.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   * @param ids Ids de los controles (fuente, lámpara y cada placa).
   * @param ids.supply Id de la fuente.
   * @param ids.lamp Id de la lámpara.
   * @param ids.board Id de la placa de un índice.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    textures: CanvasTextureFactory,
    private readonly ids: { supply: string; lamp: string; board: (index: number) => string },
  ) {
    super();
    this.art = new WorkshopArt(textures);
    const displays = new BenchDisplays(textures);
    const top = WorkshopLayout.BENCH.height;
    this.supply = new BenchSupply(displays);
    this.gear = new BenchGear(top, this.art, displays);
    const { base, elbow, head } = Workbench.LAMP;
    this.lamp = new MagnifierLamp({ base: { ...base, y: top }, elbow, head });
    const { x, z, tilt } = WorkshopLayout.TEST_SPOT;
    const bench = { position: { x, y: top + Workbench.BOARD_LIFT, z }, tilt: tilt - Math.PI / 2 };
    this.boards = Array.from({ length: Workbench.CAPACITY }, () => new ProjectBoard(bench));
  }

  /**
   * Zonas que reciben el puntero: la fuente, el cabezal de la lámpara y cada placa.
   *
   * @returns Pares control-malla.
   */
  public controls(): { id: string; hitArea: Object3D }[] {
    return [
      { id: this.ids.supply, hitArea: this.supply.hitArea },
      { id: this.ids.lamp, hitArea: this.lamp.hitArea },
      ...this.boards.map((board, index) => ({ id: this.ids.board(index), hitArea: board.hitArea })),
    ];
  }

  /**
   * Refleja el estado: placas colgadas, la del banco, la fuente y la lámpara.
   *
   * @param state Estado del banco.
   */
  public setState(state: BenchState): void {
    this.state = state;
    if (state.boards !== this.labels) {
      this.setBoards(state.boards);
    }
    this.boards.forEach((board, index) => {
      board.setState(index === state.selected, state.supply);
    });
    this.refreshAt = 0;
    this.lamp.apply(state.lamp, this.level);
  }

  /**
   * Resalta el control señalado.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.pieces.forEach((apply, key) => {
      apply(key === id);
    });
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.boards.forEach((board) => {
      board.setPower(level);
    });
    this.lamp.apply(this.state.lamp, level);
    this.refreshAt = 0;
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.boards.forEach((board) => {
      board.update(delta, elapsed);
    });
    this.gear.update(this.state.volts, this.level, elapsed);
    if (elapsed < this.refreshAt) {
      return;
    }
    const { amount, speed, refresh } = Workbench.RIPPLE;
    this.refreshAt = elapsed + refresh;
    const { volts, amps, supply } = this.state;
    const ripple = 1 + Math.sin(elapsed * speed) * amount;
    this.supply.show({ volts, amps: amps * ripple, on: supply }, this.level);
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    super.dispose();
    this.supply.dispose();
    this.gear.dispose();
    this.faces.splice(0).forEach((texture) => {
      texture.dispose();
    });
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildTable();
    this.buildSupply();
    this.root.add(
      this.lamp.build(),
      this.gear.build((texture) => this.own(texture)),
    );
    this.pieces.set(this.ids.lamp, (active) => {
      this.lamp.highlight(active);
    });
    this.buildBoards();
    this.layout.place(this.root);
    this.setPower(0);
  }

  /**
   * Mesa: cubierta de madera con tapete antiestático, patas y el soporte del punto de prueba.
   */
  private buildTable(): void {
    const { width, depth, height, top, z } = WorkshopLayout.BENCH;
    this.box({ x: width, y: top, z: depth }, { x: 0, y: height - top / 2, z }, this.materials.woodLight);
    const { inset, lift } = Workbench.MAT;
    const mat = new Mesh(
      new PlaneGeometry(width - inset * 2, depth - inset),
      new MeshStandardMaterial(Workbench.FINISH.mat),
    );
    mat.rotation.x = -Math.PI / 2;
    this.add(mat, { x: 0, y: height + lift, z });
    this.buildLegs();
    this.buildStand();
    this.buildRiser();
  }

  /**
   * Patas metálicas y repisa baja de la mesa.
   */
  private buildLegs(): void {
    const { width, depth, height, top, z } = WorkshopLayout.BENCH;
    const leg = Workbench.LEG;
    const legHeight = height - top;
    Workbench.LEGS.forEach((corner) => {
      const x = corner.x * (width / 2 - leg.inset);
      const legZ = z + corner.z * (depth / 2 - leg.inset);
      this.box(
        { x: leg.size, y: legHeight, z: leg.size },
        { x, y: legHeight / 2, z: legZ },
        this.materials.darkMetal,
      );
    });
    const shelf = Workbench.LOWER_SHELF;
    this.box(
      { x: width - shelf.inset, y: shelf.height, z: depth - shelf.inset },
      { x: 0, y: shelf.y, z },
      this.materials.woodDark,
    );
  }

  /**
   * Soporte oscuro donde apoya el borde trasero de la placa en prueba.
   */
  private buildStand(): void {
    const { x, z, stand } = WorkshopLayout.TEST_SPOT;
    const { width, depth, back } = Workbench.STAND;
    const top = WorkshopLayout.BENCH.height;
    this.box(
      { x: width, y: stand, z: depth },
      { x, y: top + stand / 2, z: z - back },
      new MeshStandardMaterial(Workbench.FINISH.stand),
    );
  }

  /**
   * Fuente de laboratorio y sus cables rojo y negro hasta el punto de prueba.
   */
  private buildSupply(): void {
    const group = this.supply.build();
    const { x, y, z } = WorkshopLayout.RISER;
    group.position.set(x, y + BenchSupply.HEIGHT / 2, z + Workbench.SUPPLY.inset);
    this.root.add(group);
    this.pieces.set(this.ids.supply, (active) => {
      this.supply.highlight(active);
    });
    Workbench.CABLES.forEach(({ color, end }, index) => {
      const start = this.supply.terminal(index).add(group.position);
      const insulation = new MeshStandardMaterial({ color, roughness: 0.5 });
      this.root.add(this.cables.curve(this.cableRoute(start, end), Workbench.CABLE.radius, insulation));
    });
  }

  /**
   * Recorrido de un cable de la fuente: sale del estante hacia la derecha (por encima del osciloscopio),
   * baja por el borde, cruza la cubierta y termina en el borde izquierdo de la placa en prueba.
   *
   * @param start Borne de la fuente.
   * @param end Punto de llegada en la placa.
   * @param end.x Horizontal, relativo al centro del punto de prueba.
   * @param end.z Profundidad.
   * @returns Puntos de paso.
   */
  private cableRoute(start: Vector3Like, end: { x: number; z: number }): Vector3Like[] {
    const top = WorkshopLayout.BENCH.height;
    const { radius, clip, edge, rest } = Workbench.CABLE;
    const tip = WorkshopLayout.TEST_SPOT.x + end.x;
    return [
      start,
      { x: edge.x, y: start.y - edge.drop, z: start.z + edge.out },
      { x: (edge.x + tip) / 2, y: top + radius, z: rest },
      { x: tip, y: top + clip, z: end.z },
    ];
  }

  /**
   * Estante elevado sobre el fondo del banco: la fuente arriba y el osciloscopio debajo.
   */
  private buildRiser(): void {
    const { x, width, depth, y, z } = WorkshopLayout.RISER;
    const { thickness, leg } = Workbench.RISER_BOARD;
    const top = WorkshopLayout.BENCH.height;
    this.box({ x: width, y: thickness, z: depth }, { x, y: y - thickness / 2, z }, this.materials.woodLight);
    const height = y - thickness - top;
    [-1, 1].forEach((side) => {
      const legX = x + side * (width / 2 - leg / 2);
      this.box(
        { x: leg, y: height, z: depth },
        { x: legX, y: top + height / 2, z },
        this.materials.darkMetal,
      );
    });
  }

  /**
   * Placas colgadas (ocultas hasta saber cuántos proyectos hay) y los ganchos de cada hueco.
   */
  private buildBoards(): void {
    const { radius, length } = Workbench.PEG;
    this.boards.forEach((board, index) => {
      this.root.add(board.build());
      board.group.visible = false;
      this.pieces.set(this.ids.board(index), (active) => {
        board.highlight(active);
      });
      [-1, 1].forEach(() => {
        const peg = new Mesh(
          new CylinderGeometry(radius, radius, length, GeometryDetail.Thin),
          this.materials.metal,
        );
        peg.rotation.x = Math.PI / 2;
        peg.visible = false;
        this.pegs.push(peg);
        this.root.add(peg);
      });
    });
  }

  /**
   * Reparte las placas en el tablero perforado, pinta su cara y muestra solo los huecos en uso.
   *
   * @param labels Etiqueta de cada placa.
   */
  private setBoards(labels: readonly string[]): void {
    this.labels = labels;
    const count = Math.min(labels.length, Workbench.CAPACITY);
    this.faces.splice(0).forEach((texture) => {
      texture.dispose();
    });
    this.boards.forEach((board, index) => {
      const label = labels[index];
      board.group.visible = label !== undefined && index < count;
      if (label !== undefined) {
        board.setFace(this.track(this.art.board(label, index)));
      }
      this.hang(board, index, count);
    });
  }

  /**
   * Cuelga una placa en su hueco del tablero perforado, con sus dos ganchos arriba.
   *
   * @param board Placa.
   * @param index Hueco.
   * @param count Placas en uso.
   */
  private hang(board: ProjectBoard, index: number, count: number): void {
    const { columns, rows, gap } = Workbench.HANG;
    const { length, spread, above } = Workbench.PEG;
    const x = columns[index % columns.length]?.x ?? 0;
    const y = rows[Math.floor(index / columns.length)]?.y ?? 0;
    const back = this.layout.pegboardZ();
    board.setHang({ x, y, z: back + gap });
    [-1, 1].forEach((side, peg) => {
      const mesh = this.pegs[index * 2 + peg];
      mesh?.position.set(x + side * spread, y + above, back + length / 2);
      if (mesh) {
        mesh.visible = index < count;
      }
    });
  }

  /**
   * Registra una textura para liberarla con el banco.
   *
   * @param texture Textura.
   * @returns La misma textura.
   */
  private track(texture: Texture): Texture {
    this.faces.push(texture);
    return texture;
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Centro.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }
}
