import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Mesita auxiliar de la estación de cableado, contra la pared derecha del taller: cubierta de madera oscura
 * con una alfombra antiestática verde, cuatro patas de tubo y un travesaño abajo. Se construye en el espacio
 * local del taller.
 */
export class WireTable {
  public static readonly TOP = 0.904;

  private static readonly BOARD = { width: 0.52, depth: 0.74, thickness: 0.03, x: 0.95, z: 0.09, y: 0.9 };
  private static readonly MAT = { inset: 0.03, thickness: 0.004, color: 0x2c5a4c };
  private static readonly WOOD = { color: 0x4a3526 };
  private static readonly LEG = { size: 0.03, inset: 0.035, floor: 0.06, color: 0x2b2f35 };
  private static readonly RAIL = { height: 0.025, y: 0.2 };
  private static readonly CORNERS = [
    { x: -1, z: -1 },
    { x: 1, z: -1 },
    { x: -1, z: 1 },
    { x: 1, z: 1 },
  ];

  public readonly group = new Group();

  private readonly metal = new MeshStandardMaterial({
    color: WireTable.LEG.color,
    roughness: 0.5,
    metalness: 0.6,
    envMapIntensity: 0.5,
  });

  /**
   * Construye la cubierta, la alfombra y las patas.
   *
   * @returns Grupo de la mesa.
   */
  public build(): Group {
    const { width, depth, thickness, x, z, y } = WireTable.BOARD;
    const wood = new MeshStandardMaterial({
      color: WireTable.WOOD.color,
      roughness: 0.7,
      envMapIntensity: 0.3,
    });
    const board = new Mesh(new BoxGeometry(width, thickness, depth), wood);
    board.position.set(x, y - thickness / 2, z);
    const { inset, thickness: mat, color } = WireTable.MAT;
    const esd = new Mesh(
      new BoxGeometry(width - inset, mat, depth - inset),
      new MeshStandardMaterial({ color, roughness: 0.85, envMapIntensity: 0.15 }),
    );
    esd.position.set(x, y + mat / 2, z);
    this.group.add(board, esd);
    this.buildLegs();
    return this.group;
  }

  /**
   * Cuatro patas y el travesaño bajo.
   */
  private buildLegs(): void {
    const { width, depth, thickness, x, z, y } = WireTable.BOARD;
    const { size, inset, floor } = WireTable.LEG;
    const height = y - thickness - floor;
    const legGeometry = new BoxGeometry(size, height, size);
    const reach = { x: width / 2 - inset, z: depth / 2 - inset };
    WireTable.CORNERS.forEach((corner) => {
      const leg = new Mesh(legGeometry, this.metal);
      leg.position.set(x + corner.x * reach.x, floor + height / 2, z + corner.z * reach.z);
      this.group.add(leg);
    });
    const { height: rail, y: railY } = WireTable.RAIL;
    const brace = new Mesh(new BoxGeometry(size, rail, reach.z * 2), this.metal);
    brace.position.set(x + reach.x, railY, z);
    const back = brace.clone();
    back.position.x = x - reach.x;
    this.group.add(brace, back);
  }
}
