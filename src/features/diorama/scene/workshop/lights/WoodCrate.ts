import { BoxGeometry, InstancedMesh, Matrix4, Quaternion, Vector3, type Material } from 'three';

/**
 * Huacal de madera de listones (una sola malla instanciada): cuatro postes en las esquinas, tres listones
 * por lado y la tapa de listones. Se construye con la base en y = 0 y centrado en el origen.
 */
export class WoodCrate {
  public static readonly SIZE = { width: 0.46, height: 0.36, top: 0.018 };

  private static readonly POST = { size: 0.04 };
  private static readonly SLAT = {
    height: 0.07,
    depth: 0.015,
    rows: [{ y: 0.07 }, { y: 0.18 }, { y: 0.29 }],
  };
  private static readonly LID = { slats: 5, gap: 0.015 };
  private static readonly PIECES = 21;

  private readonly matrix = new Matrix4();
  private readonly rotation = new Quaternion();
  private readonly axis = new Vector3(0, 1, 0);
  private count = 0;

  /**
   * Construye el huacal.
   *
   * @param material Madera.
   * @returns Malla instanciada.
   */
  public build(material: Material): InstancedMesh {
    const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, WoodCrate.PIECES);
    this.count = 0;
    this.posts(mesh);
    this.sides(mesh);
    this.lid(mesh);
    mesh.count = this.count;
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  /**
   * Postes de las esquinas.
   *
   * @param mesh Malla instanciada.
   */
  private posts(mesh: InstancedMesh): void {
    const { width, height } = WoodCrate.SIZE;
    const { size } = WoodCrate.POST;
    const edge = (width - size) / 2;
    [-1, 1].forEach((x) => {
      [-1, 1].forEach((z) => {
        this.piece(mesh, { x: x * edge, y: height / 2, z: z * edge }, { x: size, y: height, z: size }, 0);
      });
    });
  }

  /**
   * Listones de los cuatro lados.
   *
   * @param mesh Malla instanciada.
   */
  private sides(mesh: InstancedMesh): void {
    const { width } = WoodCrate.SIZE;
    const { height, depth, rows } = WoodCrate.SLAT;
    const edge = (width - depth) / 2;
    [0, 1, 2, 3].forEach((side) => {
      const turn = (side * Math.PI) / 2;
      rows.forEach(({ y }) => {
        const position = { x: Math.sin(turn) * edge, y, z: Math.cos(turn) * edge };
        this.piece(mesh, position, { x: width, y: height, z: depth }, turn);
      });
    });
  }

  /**
   * Listones de la tapa.
   *
   * @param mesh Malla instanciada.
   */
  private lid(mesh: InstancedMesh): void {
    const { width, height, top } = WoodCrate.SIZE;
    const { slats, gap } = WoodCrate.LID;
    const slat = (width - gap * (slats - 1)) / slats;
    for (let index = 0; index < slats; index += 1) {
      const x = -width / 2 + slat / 2 + index * (slat + gap);
      this.piece(mesh, { x, y: height + top / 2, z: 0 }, { x: slat, y: top, z: width }, 0);
    }
  }

  /**
   * Agrega una pieza.
   *
   * @param mesh Malla instanciada.
   * @param position Centro.
   * @param position.x Horizontal.
   * @param position.y Altura.
   * @param position.z Profundidad.
   * @param size Medidas.
   * @param size.x Largo.
   * @param size.y Alto.
   * @param size.z Ancho.
   * @param turn Giro en Y.
   */
  private piece(
    mesh: InstancedMesh,
    position: { x: number; y: number; z: number },
    size: { x: number; y: number; z: number },
    turn: number,
  ): void {
    this.rotation.setFromAxisAngle(this.axis, turn);
    this.matrix.compose(
      new Vector3(position.x, position.y, position.z),
      this.rotation,
      new Vector3(size.x, size.y, size.z),
    );
    mesh.setMatrixAt(this.count, this.matrix);
    this.count += 1;
  }
}
