import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Object3D,
  type Texture,
} from 'three';

/**
 * Teclado del teléfono público: una tecla de plástico por cada texto, con su número impreso (una celda del
 * atlas), un brillo al señalarla y un hundimiento breve al pulsarla. Mira hacia +z con la base en z = 0.
 */
export class PhoneKeypad {
  private static readonly KEY = { width: 0.032, height: 0.025, depth: 0.01 };
  private static readonly GRID = { columns: 3, spacingX: 0.042, spacingY: 0.032 };
  private static readonly FINISH = { color: 0xb9c2bd, roughness: 0.6 };
  private static readonly LABEL = { scale: 0.9, lift: 0.0005 };
  private static readonly HOVER = { color: 0x3fd8ff, strength: 0.35 };
  private static readonly PRESS = { depth: 0.006, duration: 0.14 };

  private readonly group = new Group();
  private readonly keys = new Map<
    string,
    { mesh: Mesh; materials: MeshStandardMaterial[]; pressed: number }
  >();
  private hovered: string | null = null;

  /**
   * Crea el teclado.
   *
   * @param labels Texto de cada tecla, en orden de lectura.
   * @param atlas Atlas con los números impresos (ver `PhoneBoothArt.keys`).
   */
  public constructor(
    private readonly labels: readonly string[],
    private readonly atlas: Texture,
  ) {}

  /**
   * Mallas de las teclas con su texto, para lanzarles el rayo del puntero.
   *
   * @returns Pares tecla-malla.
   */
  public get controls(): { id: string; hitArea: Object3D }[] {
    return [...this.keys].map(([id, { mesh }]) => ({ id, hitArea: mesh }));
  }

  /**
   * Construye las teclas.
   *
   * @returns Grupo con el teclado, centrado en x y con la primera fila en y = 0.
   */
  public build(): Group {
    const { width, height, depth } = PhoneKeypad.KEY;
    const { columns, spacingX, spacingY } = PhoneKeypad.GRID;
    const rows = Math.ceil(this.labels.length / columns);
    this.labels.forEach((label, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const material = new MeshStandardMaterial(PhoneKeypad.FINISH);
      const mesh = new Mesh(new BoxGeometry(width, height, depth), material);
      mesh.position.set((column - (columns - 1) / 2) * spacingX, -row * spacingY, depth / 2);
      const face = this.label(column, row, rows);
      mesh.add(face.mesh);
      this.group.add(mesh);
      this.keys.set(label, { mesh, materials: [material, face.material], pressed: 0 });
    });
    return this.group;
  }

  /**
   * Ilumina la tecla señalada (y apaga la anterior).
   *
   * @param id Tecla o `null`.
   */
  public highlight(id: string | null): void {
    this.tint(this.hovered, 0);
    this.hovered = id;
    this.tint(id, PhoneKeypad.HOVER.strength);
  }

  /**
   * Hunde una tecla un instante.
   *
   * @param id Tecla.
   */
  public press(id: string): void {
    const key = this.keys.get(id);
    if (key) {
      key.pressed = PhoneKeypad.PRESS.duration;
    }
  }

  /**
   * Devuelve las teclas hundidas a su sitio.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const { depth, duration } = PhoneKeypad.PRESS;
    this.keys.forEach((key) => {
      key.pressed = Math.max(key.pressed - delta, 0);
      key.mesh.position.z = PhoneKeypad.KEY.depth / 2 - (depth * key.pressed) / duration;
    });
  }

  /**
   * Número impreso sobre la cara de una tecla: un plano con las coordenadas de su celda del atlas.
   *
   * @param column Columna de la tecla.
   * @param row Fila de la tecla.
   * @param rows Filas del atlas.
   * @returns Plano del número y su material.
   */
  private label(column: number, row: number, rows: number): { mesh: Mesh; material: MeshStandardMaterial } {
    const { width, height, depth } = PhoneKeypad.KEY;
    const { scale, lift } = PhoneKeypad.LABEL;
    const geometry = new PlaneGeometry(width * scale, height * scale);
    const uv = geometry.getAttribute('uv');
    const columns = PhoneKeypad.GRID.columns;
    for (let index = 0; index < uv.count; index++) {
      uv.setXY(index, (column + uv.getX(index)) / columns, 1 - (row + 1 - uv.getY(index)) / rows);
    }
    const material = new MeshStandardMaterial({ roughness: PhoneKeypad.FINISH.roughness, map: this.atlas });
    const mesh = new Mesh(geometry, material);
    mesh.position.z = depth / 2 + lift;
    return { mesh, material };
  }

  /**
   * Aplica el brillo de "señalada" a una tecla.
   *
   * @param id Tecla o `null`.
   * @param strength Intensidad del brillo.
   */
  private tint(id: string | null, strength: number): void {
    const key = id === null ? undefined : this.keys.get(id);
    key?.materials.forEach((material) => {
      material.emissive.set(PhoneKeypad.HOVER.color).multiplyScalar(strength);
    });
  }
}
