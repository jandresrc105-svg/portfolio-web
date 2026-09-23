import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Material,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { WorkshopArt } from './WorkshopArt';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Local del taller de electrónica, al estilo de los puestitos de componentes de Akihabara: piso de concreto,
 * paredes pintadas, techo con alero, cortina metálica enrollada, tablero perforado al fondo y un tubo
 * fluorescente bajo el techo. El letrero de neón, el banco y los equipos interactivos son piezas aparte.
 */
export class RepairShop extends SceneObject implements Powerable {
  private static readonly FINISH = {
    wall: { color: 0x2f3d44, roughness: 0.85, metalness: 0, envMapIntensity: 0.3 },
    board: { color: 0x14171c, roughness: 0.6, metalness: 0.3 },
    pegboard: { roughness: 0.85, metalness: 0, envMapIntensity: 0.2 },
  };
  private static readonly SLAB_MARGIN = 0.1;
  private static readonly ROOF = { overhang: 0.24, front: 0.5, height: 0.07, z: 0.2 };
  private static readonly SIGN_BOARD = { width: 2.6, height: 0.44, depth: 0.05, lift: 0.29, z: 1.45 };
  private static readonly SHUTTER = { radius: 0.07, inset: 0.1, drop: 0.09, z: 0.04 };
  private static readonly SLATS = { height: 0.05, depth: 0.012, drop: 0.14, inset: 0.12 };
  private static readonly LIFT = 0.001;
  private static readonly TUBE = {
    radius: 0.018,
    length: 1.8,
    drop: 0.07,
    z: 0.05,
    color: 0xe4f4ff,
    glow: 3,
  };
  private static readonly OFF_GLOW = 0.04;

  private readonly tube = new MeshBasicMaterial({ color: RepairShop.TUBE.color, toneMapped: false });
  private readonly art: WorkshopArt;
  private readonly layout = new WorkshopLayout();

  /**
   * Crea el local.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    textures: CanvasTextureFactory,
  ) {
    super();
    this.art = new WorkshopArt(textures);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    const glow = Math.max(level * RepairShop.TUBE.glow, RepairShop.OFF_GLOW);
    this.tube.color.set(RepairShop.TUBE.color).multiplyScalar(glow);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildShell();
    this.buildFront();
    this.buildPegboard();
    this.buildTube();
    this.layout.place(this.root);
    this.setPower(0);
  }

  /**
   * Piso, pared del fondo, paredes laterales y techo.
   */
  private buildShell(): void {
    const { width, depth, height, wall, floor } = WorkshopLayout.SHOP;
    const paint = new MeshStandardMaterial(RepairShop.FINISH.wall);
    const margin = RepairShop.SLAB_MARGIN;
    this.box(
      { x: width + margin, y: floor, z: depth + margin },
      { x: 0, y: floor / 2, z: 0 },
      this.materials.concrete,
    );
    this.box({ x: width, y: height, z: wall }, { x: 0, y: height / 2, z: (wall - depth) / 2 }, paint);
    [-1, 1].forEach((side) => {
      this.box(
        { x: wall, y: height, z: depth },
        { x: (side * (width - wall)) / 2, y: height / 2, z: 0 },
        paint,
      );
    });
    this.buildRoof();
  }

  /**
   * Techo con alero hacia la calle.
   */
  private buildRoof(): void {
    const { width, depth, height } = WorkshopLayout.SHOP;
    const roof = RepairShop.ROOF;
    this.box(
      { x: width + roof.overhang, y: roof.height, z: depth + roof.front },
      { x: 0, y: height + roof.height / 2, z: roof.z },
      this.materials.roof,
    );
  }

  /**
   * Tablero del letrero sobre el alero y cortina metálica enrollada arriba de la entrada.
   */
  private buildFront(): void {
    const { height } = WorkshopLayout.SHOP;
    const board = RepairShop.SIGN_BOARD;
    this.box(
      { x: board.width, y: board.height, z: board.depth },
      { x: 0, y: height + board.lift, z: board.z },
      new MeshStandardMaterial(RepairShop.FINISH.board),
    );
    this.buildShutter();
  }

  /**
   * Cortina metálica enrollada arriba de la entrada, con las primeras lamas colgando.
   */
  private buildShutter(): void {
    const { width, depth, height } = WorkshopLayout.SHOP;
    const { radius, inset, drop, z } = RepairShop.SHUTTER;
    const roll = new Mesh(
      new CylinderGeometry(radius, radius, width - inset, GeometryDetail.Medium),
      this.materials.darkMetal,
    );
    roll.rotation.z = Math.PI / 2;
    this.add(roll, { x: 0, y: height - drop, z: depth / 2 - z });
    const slats = RepairShop.SLATS;
    this.box(
      { x: width - slats.inset, y: slats.height, z: slats.depth },
      { x: 0, y: height - slats.drop, z: depth / 2 - z },
      this.materials.roof,
    );
  }

  /**
   * Tablero perforado de la pared del fondo, donde cuelgan las placas.
   */
  private buildPegboard(): void {
    const { width, height, y } = WorkshopLayout.PEGBOARD;
    const material = new MeshStandardMaterial({
      ...RepairShop.FINISH.pegboard,
      map: this.own(this.art.pegboard()),
    });
    this.add(new Mesh(new PlaneGeometry(width, height), material), {
      x: 0,
      y,
      z: this.layout.pegboardZ() + RepairShop.LIFT,
    });
  }

  /**
   * Tubo fluorescente bajo el techo, sobre la entrada.
   */
  private buildTube(): void {
    const { radius, length, drop, z } = RepairShop.TUBE;
    const tube = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.Low), this.tube);
    tube.rotation.z = Math.PI / 2;
    this.add(tube, { x: 0, y: WorkshopLayout.SHOP.height - drop, z });
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Posición del centro.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }
}
