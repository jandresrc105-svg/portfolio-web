import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Object3D,
  type Texture,
} from 'three';

/**
 * Laptop abierta de aluminio: base con teclado y touchpad, tapa inclinada hacia atrás con la pantalla del
 * IDE (emisiva) y zonas de clic invisibles sobre las partes de la pantalla que responden (la lista de
 * programas y el botón "Subir"). El puerto USB queda en el costado derecho. El grupo tiene origen en el
 * centro de la base, apoyado en la mesa, con la pantalla mirando a +z.
 */
export class FirmwareLaptop {
  private static readonly BASE = { width: 0.32, height: 0.016, depth: 0.22 };
  private static readonly LID = { height: 0.24, depth: 0.007, tilt: 0.3 };
  private static readonly SCREEN = { width: 0.296, height: 0.222, y: 0.121, lift: 0.0006 };
  private static readonly KEYBOARD = { width: 0.28, depth: 0.1, z: -0.035 };
  private static readonly TOUCHPAD = { width: 0.1, depth: 0.06, z: 0.066, color: 0x7d848d };
  private static readonly PORT = { width: 0.004, height: 0.006, depth: 0.012, z: -0.06, color: 0x08090a };
  private static readonly ALUMINIUM = {
    color: 0x8c939c,
    roughness: 0.35,
    metalness: 0.6,
    envMapIntensity: 0.45,
  };
  private static readonly GLOW = { on: 1.25, off: 0.05 };
  private static readonly LIFT = 0.0004;

  public readonly group = new Group();

  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private readonly lid = new Group();
  private readonly hitAreas: { id: string; hitArea: Object3D }[] = [];

  /**
   * Construye la laptop.
   *
   * @param art Texturas de la pantalla y del teclado.
   * @param art.screen Pantalla (canvas dinámico).
   * @param art.keyboard Teclado.
   * @param regions Zonas de la pantalla que responden, en píxeles del canvas.
   * @param regions.canvas Medidas del canvas.
   * @param regions.canvas.width Ancho.
   * @param regions.canvas.height Alto.
   * @param regions.areas Id y rectángulo de cada zona.
   * @returns Grupo de la laptop.
   */
  public build(
    art: { screen: Texture; keyboard: Texture },
    regions: {
      canvas: { width: number; height: number };
      areas: { id: string; rect: { x: number; y: number; width: number; height: number } }[];
    },
  ): Group {
    this.buildBase(art.keyboard);
    this.buildLid(art.screen);
    regions.areas.forEach(({ id, rect }) => {
      this.hitAreas.push({ id, hitArea: this.area(rect, regions.canvas) });
    });
    return this.group;
  }

  /**
   * Zonas de clic de la pantalla.
   *
   * @returns Id y zona de cada una.
   */
  public controls(): { id: string; hitArea: Object3D }[] {
    return this.hitAreas;
  }

  /**
   * Boca del puerto USB (costado derecho), de donde sale el cable a la placa.
   *
   * @returns Punto en el espacio del grupo.
   */
  public usbPort(): Vector3 {
    const { width, height } = FirmwareLaptop.BASE;
    return new Vector3(width / 2 + FirmwareLaptop.PORT.width, height / 2, FirmwareLaptop.PORT.z);
  }

  /**
   * Brillo de la pantalla.
   *
   * @param level Brillo general.
   */
  public setGlow(level: number): void {
    const { on, off } = FirmwareLaptop.GLOW;
    this.screen.color.setScalar(Math.max(on * level, off));
  }

  /**
   * Base con teclado, touchpad y puerto USB.
   *
   * @param keyboard Textura del teclado.
   */
  private buildBase(keyboard: Texture): void {
    const { width, height, depth } = FirmwareLaptop.BASE;
    const aluminium = new MeshStandardMaterial(FirmwareLaptop.ALUMINIUM);
    const base = new Mesh(new BoxGeometry(width, height, depth), aluminium);
    base.position.y = height / 2;
    const keys = FirmwareLaptop.KEYBOARD;
    this.deckPlane(keys, new MeshStandardMaterial({ map: keyboard, roughness: 0.6 }));
    const pad = FirmwareLaptop.TOUCHPAD;
    this.deckPlane(pad, new MeshStandardMaterial({ color: pad.color, roughness: 0.3, metalness: 0.4 }));
    this.group.add(base);
    this.buildPort();
  }

  /**
   * Plano apoyado sobre la base (teclado o touchpad).
   *
   * @param size Medidas y posición.
   * @param size.width Ancho.
   * @param size.depth Profundidad.
   * @param size.z Posición en profundidad.
   * @param material Material.
   */
  private deckPlane(size: { width: number; depth: number; z: number }, material: MeshStandardMaterial): void {
    const plane = new Mesh(new PlaneGeometry(size.width, size.depth), material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, FirmwareLaptop.BASE.height + FirmwareLaptop.LIFT, size.z);
    this.group.add(plane);
  }

  /**
   * Boca negra del puerto USB en el costado derecho.
   */
  private buildPort(): void {
    const { width, height } = FirmwareLaptop.BASE;
    const port = FirmwareLaptop.PORT;
    const hole = new Mesh(
      new BoxGeometry(port.width, port.height, port.depth),
      new MeshBasicMaterial({ color: port.color }),
    );
    hole.position.set(width / 2, height / 2, port.z);
    this.group.add(hole);
  }

  /**
   * Tapa inclinada, con bisagra en el borde trasero de la base, y la pantalla.
   *
   * @param screen Textura de la pantalla.
   */
  private buildLid(screen: Texture): void {
    const { width, height: baseHeight, depth: baseDepth } = FirmwareLaptop.BASE;
    const { height, depth, tilt } = FirmwareLaptop.LID;
    this.lid.position.set(0, baseHeight, -baseDepth / 2);
    this.lid.rotation.x = -tilt;
    const shell = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial(FirmwareLaptop.ALUMINIUM),
    );
    shell.position.set(0, height / 2, -depth / 2);
    this.screen.map = screen;
    const size = FirmwareLaptop.SCREEN;
    const panel = new Mesh(new PlaneGeometry(size.width, size.height), this.screen);
    panel.position.set(0, size.y, size.lift);
    this.lid.add(shell, panel);
    this.group.add(this.lid);
  }

  /**
   * Zona de clic invisible sobre un rectángulo de la pantalla.
   *
   * @param rect Rectángulo en píxeles del canvas.
   * @param rect.x Izquierda.
   * @param rect.y Arriba.
   * @param rect.width Ancho.
   * @param rect.height Alto.
   * @param canvas Medidas del canvas.
   * @param canvas.width Ancho.
   * @param canvas.height Alto.
   * @returns Zona.
   */
  private area(
    rect: { x: number; y: number; width: number; height: number },
    canvas: { width: number; height: number },
  ): Mesh {
    const size = FirmwareLaptop.SCREEN;
    const scaleX = size.width / canvas.width;
    const scaleY = size.height / canvas.height;
    const zone = new Mesh(
      new PlaneGeometry(rect.width * scaleX, rect.height * scaleY),
      new MeshBasicMaterial({ visible: false }),
    );
    const x = (rect.x + rect.width / 2) * scaleX - size.width / 2;
    const y = size.y + size.height / 2 - (rect.y + rect.height / 2) * scaleY;
    zone.position.set(x, y, size.lift * 2);
    this.lid.add(zone);
    return zone;
  }
}
