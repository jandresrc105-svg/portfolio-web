import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type Texture,
  type Vector3Like,
} from 'three';

/**
 * Placa de un proyecto: tarjeta con su máscara serigrafiada, un microcontrolador, integrados, conector,
 * regleta de pines y tres LEDs. Cuelga del tablero perforado y, al elegirla, baja al banco de pruebas en un
 * arco y queda inclinada hacia quien mira; si la fuente está encendida, sus LEDs corren en secuencia.
 */
export class ProjectBoard {
  private static readonly SIZE = { width: 0.3, height: 0.2, thickness: 0.012 };
  private static readonly EDGE = { color: 0x0f1a12, roughness: 0.6 };
  private static readonly CHIPS = [
    { x: -0.05, y: 0.02, width: 0.064, height: 0.064 },
    { x: 0.065, y: 0.035, width: 0.036, height: 0.024 },
    { x: 0.075, y: -0.015, width: 0.024, height: 0.024 },
  ];
  private static readonly CHIP = { depth: 0.008, color: 0x121216 };
  private static readonly HEADER = {
    width: 0.13,
    height: 0.012,
    depth: 0.014,
    x: 0.01,
    y: 0.075,
    color: 0x1b1b1d,
  };
  private static readonly CONNECTOR = {
    width: 0.04,
    height: 0.034,
    depth: 0.018,
    x: -0.125,
    y: 0.045,
    color: 0xb9c0c6,
  };
  private static readonly LEDS = [
    { x: 0.098, color: 0x39ff7a },
    { x: 0.116, color: 0xffb020 },
    { x: 0.134, color: 0x3fb8ff },
  ];
  private static readonly LED = { size: 0.009, y: -0.06, glow: 6, off: 0.05, chase: 5 };
  private static readonly TRAVEL = { rate: 4, lift: 0.1, forward: 0.12, settle: 0.001 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35, idle: 0xffffff };
  private static readonly SELF_LIGHT = 0.12;

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly face = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 });
  private readonly leds = ProjectBoard.LEDS.map(() => new MeshBasicMaterial({ toneMapped: false }));
  private readonly hang = new Vector3();
  private readonly bench: { position: Vector3; tilt: number };
  private blend = 0;
  private goal = 0;
  private powered = false;
  private level = 0;

  /**
   * Crea la placa.
   *
   * @param bench Pose en el banco de pruebas: centro y giro sobre x (tumbada e inclinada hacia el frente).
   * @param bench.position Centro.
   * @param bench.tilt Giro sobre x.
   */
  public constructor(bench: { position: Vector3Like; tilt: number }) {
    this.bench = { position: new Vector3().copy(bench.position), tilt: bench.tilt };
    const { width, height, thickness } = ProjectBoard.SIZE;
    const edge = new MeshStandardMaterial(ProjectBoard.EDGE);
    this.hitArea = new Mesh(new BoxGeometry(width, height, thickness), [
      edge,
      edge,
      edge,
      edge,
      this.face,
      edge,
    ]);
  }

  /**
   * Construye la tarjeta y sus componentes (en la cara +z).
   *
   * @returns Grupo de la placa.
   */
  public build(): Group {
    this.group.add(this.hitArea);
    this.buildChips();
    this.buildLeds();
    this.face.emissive.setScalar(ProjectBoard.SELF_LIGHT);
    return this.group;
  }

  /**
   * Fija dónde cuelga la placa en el tablero perforado.
   *
   * @param position Centro de la placa colgada.
   */
  public setHang(position: Vector3Like): void {
    this.hang.copy(position);
    this.place();
  }

  /**
   * Cambia la cara serigrafiada.
   *
   * @param texture Textura nueva (la anterior la libera quien la creó).
   */
  public setFace(texture: Texture): void {
    this.face.map = texture;
    this.face.emissiveMap = texture;
    this.face.needsUpdate = true;
  }

  /**
   * Indica si la placa está en el banco y si recibe corriente.
   *
   * @param selected Si está en el banco.
   * @param powered Si la fuente la alimenta.
   */
  public setState(selected: boolean, powered: boolean): void {
    this.goal = selected ? 1 : 0;
    this.powered = selected && powered;
  }

  /**
   * Fija el brillo general (encendido de la escena).
   *
   * @param level Brillo [0, 1].
   */
  public setPower(level: number): void {
    this.level = level;
  }

  /**
   * Resalta la placa señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    const { color, strength, idle } = ProjectBoard.HIGHLIGHT;
    this.face.emissive.set(active ? color : idle).multiplyScalar(active ? strength : ProjectBoard.SELF_LIGHT);
  }

  /**
   * Mueve la placa hacia su pose y hace correr sus LEDs.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  public update(delta: number, elapsed: number): void {
    const { rate, settle } = ProjectBoard.TRAVEL;
    if (Math.abs(this.goal - this.blend) > settle) {
      this.blend += (this.goal - this.blend) * Math.min(delta * rate, 1);
      this.place();
    }
    const { chase, glow, off } = ProjectBoard.LED;
    const step = Math.floor(elapsed * chase) % this.leds.length;
    this.leds.forEach((material, index) => {
      const lit = this.powered && (index === 0 || index === step);
      const color = ProjectBoard.LEDS[index]?.color ?? 0;
      material.color.set(color).multiplyScalar(lit ? glow * this.level : off);
    });
  }

  /**
   * Coloca la placa entre la pose colgada y la del banco, con un arco para no chocar con lo que hay debajo.
   */
  private place(): void {
    const { lift, forward } = ProjectBoard.TRAVEL;
    const arc = Math.sin(this.blend * Math.PI);
    this.group.position.lerpVectors(this.hang, this.bench.position, this.blend);
    this.group.position.y += arc * lift;
    this.group.position.z += arc * forward;
    this.group.rotation.x = this.blend * this.bench.tilt;
  }

  /**
   * Microcontrolador e integrados.
   */
  private buildChips(): void {
    const { thickness } = ProjectBoard.SIZE;
    const { depth, color } = ProjectBoard.CHIP;
    const black = new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    ProjectBoard.CHIPS.forEach(({ x, y, width, height }) => {
      this.part({ x: width, y: height, z: depth }, { x, y, z: (thickness + depth) / 2 }, black);
    });
    this.buildPorts();
  }

  /**
   * Regleta de pines y conector USB.
   */
  private buildPorts(): void {
    const { thickness } = ProjectBoard.SIZE;
    const header = ProjectBoard.HEADER;
    const plastic = new MeshStandardMaterial({ color: header.color, roughness: 0.6 });
    this.part(
      { x: header.width, y: header.height, z: header.depth },
      { x: header.x, y: header.y, z: (thickness + header.depth) / 2 },
      plastic,
    );
    const port = ProjectBoard.CONNECTOR;
    const metal = new MeshStandardMaterial({ color: port.color, roughness: 0.3, metalness: 0.9 });
    this.part(
      { x: port.width, y: port.height, z: port.depth },
      { x: port.x, y: port.y, z: (thickness + port.depth) / 2 },
      metal,
    );
  }

  /**
   * Los tres LEDs de estado en la esquina inferior derecha.
   */
  private buildLeds(): void {
    const { size, y } = ProjectBoard.LED;
    const z = (ProjectBoard.SIZE.thickness + size) / 2;
    ProjectBoard.LEDS.forEach(({ x }, index) => {
      const material = this.leds[index];
      if (material) {
        this.part({ x: size, y: size, z: size }, { x, y, z }, material);
      }
    });
  }

  /**
   * Agrega una pieza con forma de caja sobre la tarjeta.
   *
   * @param size Dimensiones.
   * @param position Posición en la tarjeta.
   * @param material Material.
   */
  private part(
    size: Vector3Like,
    position: Vector3Like,
    material: MeshStandardMaterial | MeshBasicMaterial,
  ): void {
    const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    this.group.add(mesh);
  }
}
