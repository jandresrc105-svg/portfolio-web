import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Material } from 'three';

/**
 * Tira LED del banco: perfil de aluminio contra la pared del fondo, sobre la cubierta, con la línea de LED
 * cálidos por debajo. Tiene dos tramos para no cruzar el estante de la fuente.
 */
export class LedStrip {
  private static readonly SEGMENTS = [
    { from: -1.18, to: -0.66 },
    { from: 0.06, to: 1.18 },
  ];
  private static readonly CHANNEL = { y: 1.31, height: 0.012, depth: 0.022, gap: 0.012 };
  private static readonly LEDS = {
    height: 0.004,
    depth: 0.012,
    inset: 0.01,
    color: 0xffe9cc,
    glow: 3.5,
    off: 0.04,
  };

  public readonly group = new Group();

  private readonly leds = new MeshBasicMaterial({ toneMapped: false });

  /**
   * Crea la tira.
   *
   * @param channel Material del perfil de aluminio.
   * @param wallZ Cara de la pared del fondo (z local).
   */
  public constructor(
    private readonly channel: Material,
    private readonly wallZ: number,
  ) {}

  /**
   * Construye los tramos.
   *
   * @returns Grupo.
   */
  public build(): Group {
    const { y, height, depth, gap } = LedStrip.CHANNEL;
    const z = this.wallZ + gap + depth / 2;
    const leds = LedStrip.LEDS;
    LedStrip.SEGMENTS.forEach(({ from, to }) => {
      const x = (from + to) / 2;
      const body = new Mesh(new BoxGeometry(to - from, height, depth), this.channel);
      body.position.set(x, y, z);
      const line = new Mesh(new BoxGeometry(to - from - leds.inset, leds.height, leds.depth), this.leds);
      line.position.set(x, y - height / 2, z);
      this.group.add(body, line);
    });
    return this.group;
  }

  /**
   * Fija el brillo de los LED.
   *
   * @param level Brillo [0, 1].
   */
  public apply(level: number): void {
    const { color, glow, off } = LedStrip.LEDS;
    this.leds.color.set(color).multiplyScalar(Math.max(level * glow, off));
  }
}
