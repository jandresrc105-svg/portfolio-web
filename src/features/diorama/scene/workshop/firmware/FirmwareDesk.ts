import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';
import type { MaterialLibrary } from '../../MaterialLibrary';

/**
 * Mesa lateral del laboratorio de firmware, contra la pared izquierda del taller: cubierta de madera con una
 * alfombra antiestática azul, patas de metal, un estante bajo con cajas de componentes y un letrero de neón
 * en la pared. Se construye directamente en el espacio local del taller.
 */
export class FirmwareDesk {
  public static readonly TOP = 0.9;
  public static readonly CENTER = { x: -0.96, z: 0.25 };

  private static readonly SLAB = { width: 0.52, depth: 1.06, thickness: 0.03 };
  private static readonly MAT = { width: 0.46, depth: 1, thickness: 0.002, color: 0x2c5d7a };
  private static readonly LEG = { size: 0.035, inset: 0.03, floor: 0.06 };
  private static readonly SHELF = { y: 0.26, thickness: 0.015, inset: 0.05 };
  private static readonly BINS = [
    { z: -0.3, color: 0xd8433b },
    { z: -0.08, color: 0xe8c230 },
    { z: 0.14, color: 0x2f64c9 },
  ];
  private static readonly BIN = { width: 0.2, height: 0.1, depth: 0.16 };
  private static readonly SIGN = { width: 0.44, height: 0.11, x: -1.232, y: 1.58, glow: 3.2, off: 0.05 };

  public readonly group = new Group();

  private readonly sign = new MeshBasicMaterial({ toneMapped: false, transparent: true, depthWrite: false });

  /**
   * Crea la mesa.
   *
   * @param materials Materiales compartidos.
   */
  public constructor(private readonly materials: MaterialLibrary) {}

  /**
   * Construye la mesa, el estante y el letrero.
   *
   * @param sign Textura del letrero.
   * @returns Grupo de la mesa.
   */
  public build(sign: Texture): Group {
    this.buildTop();
    this.buildLegs();
    this.buildShelf();
    this.buildSign(sign);
    return this.group;
  }

  /**
   * Brillo del letrero.
   *
   * @param level Brillo general.
   */
  public setGlow(level: number): void {
    const { glow, off } = FirmwareDesk.SIGN;
    this.sign.color.setScalar(Math.max(glow * level, off));
  }

  /**
   * Cubierta de madera con la alfombra antiestática.
   */
  private buildTop(): void {
    const { width, depth, thickness } = FirmwareDesk.SLAB;
    const { x, z } = FirmwareDesk.CENTER;
    const slab = new Mesh(new BoxGeometry(width, thickness, depth), this.materials.woodDark);
    slab.position.set(x, FirmwareDesk.TOP - thickness / 2, z);
    const mat = FirmwareDesk.MAT;
    const cover = new Mesh(
      new BoxGeometry(mat.width, mat.thickness, mat.depth),
      new MeshStandardMaterial({ color: mat.color, roughness: 0.85, envMapIntensity: 0.2 }),
    );
    cover.position.set(x, FirmwareDesk.TOP + mat.thickness / 2, z);
    this.group.add(slab, cover);
  }

  /**
   * Cuatro patas de metal.
   */
  private buildLegs(): void {
    const { width, depth, thickness } = FirmwareDesk.SLAB;
    const { size, inset, floor } = FirmwareDesk.LEG;
    const height = FirmwareDesk.TOP - thickness - floor;
    const geometry = new BoxGeometry(size, height, size);
    const { x, z } = FirmwareDesk.CENTER;
    const reach = { x: width / 2 - inset, z: depth / 2 - inset };
    [-1, 1].forEach((sideX) => {
      [-1, 1].forEach((sideZ) => {
        const leg = new Mesh(geometry, this.materials.darkMetal);
        leg.position.set(x + sideX * reach.x, floor + height / 2, z + sideZ * reach.z);
        this.group.add(leg);
      });
    });
  }

  /**
   * Estante bajo con cajas de componentes de colores.
   */
  private buildShelf(): void {
    const { width, depth } = FirmwareDesk.SLAB;
    const { y, thickness, inset } = FirmwareDesk.SHELF;
    const { x, z } = FirmwareDesk.CENTER;
    const board = new Mesh(
      new BoxGeometry(width - inset, thickness, depth - inset),
      this.materials.darkMetal,
    );
    board.position.set(x, y, z);
    this.group.add(board);
    const bin = FirmwareDesk.BIN;
    FirmwareDesk.BINS.forEach(({ z: offset, color }) => {
      const box = new Mesh(
        new BoxGeometry(bin.width, bin.height, bin.depth),
        new MeshStandardMaterial({ color, roughness: 0.55, envMapIntensity: 0.3 }),
      );
      box.position.set(x, y + thickness / 2 + bin.height / 2, z + offset);
      this.group.add(box);
    });
  }

  /**
   * Letrero de neón en la pared izquierda, mirando hacia adentro del taller.
   *
   * @param texture Textura del letrero.
   */
  private buildSign(texture: Texture): void {
    const { width, height, x, y } = FirmwareDesk.SIGN;
    this.sign.map = texture;
    const plate = new Mesh(new PlaneGeometry(width, height), this.sign);
    plate.rotation.y = Math.PI / 2;
    plate.position.set(x, y, FirmwareDesk.CENTER.z);
    this.group.add(plate);
  }
}
