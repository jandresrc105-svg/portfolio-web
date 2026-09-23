import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { BenchDisplays } from './BenchDisplays';

/**
 * Fuente de laboratorio: gabinete gris con los displays de voltaje y corriente, dos perillas, el interruptor
 * con su LED y los bornes rojo y negro de donde salen los cables hacia la placa del banco. Todo el gabinete
 * es la zona que recibe el clic (prender o apagar). Se construye en un grupo con origen en el centro del
 * gabinete.
 */
export class BenchSupply {
  public static readonly HEIGHT = 0.15;

  private static readonly BODY = { width: 0.28, height: BenchSupply.HEIGHT, depth: 0.24, color: 0x3a4048 };
  private static readonly PANEL = { color: 0x1b1e22, inset: 0.012, lift: 0.001 };
  private static readonly DISPLAY = { width: 0.15, height: 0.054, x: -0.045, y: 0.03 };
  private static readonly KNOBS = [{ x: 0.075 }, { x: 0.112 }];
  private static readonly KNOB = { radius: 0.013, depth: 0.014, y: 0.03, color: 0x15171a };
  private static readonly TERMINALS = [
    { x: 0.075, color: 0xd02a2a },
    { x: 0.112, color: 0x16181b },
  ];
  private static readonly TERMINAL = { radius: 0.009, depth: 0.02, y: -0.04 };
  private static readonly SWITCH = { width: 0.034, height: 0.024, depth: 0.012, x: -0.095, y: -0.04 };
  private static readonly LED = { size: 0.008, x: -0.06, color: 0x3dff7a, glow: 5, off: 0.05 };
  private static readonly SCREEN = { glow: 1.4, off: 0.06 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.3 };
  private static readonly DECIMALS = 3;

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly body = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.5 });
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private readonly led = new MeshBasicMaterial({ toneMapped: false });
  private shown = '';

  /**
   * Crea la fuente.
   *
   * @param displays Pintor de los displays.
   */
  public constructor(private readonly displays: BenchDisplays) {
    const { width, height, depth, color } = BenchSupply.BODY;
    this.body.color.set(color);
    this.hitArea = new Mesh(new BoxGeometry(width, height, depth), this.body);
  }

  /**
   * Construye el gabinete y su frente.
   *
   * @returns Grupo de la fuente.
   */
  public build(): Group {
    this.group.add(this.hitArea);
    this.buildPanel();
    this.buildControls();
    return this.group;
  }

  /**
   * Posición de un borne (0 = rojo, 1 = negro) en el espacio del grupo, de donde sale su cable.
   *
   * @param index Borne.
   * @returns Punta del borne.
   */
  public terminal(index: number): Vector3 {
    const { depth } = BenchSupply.BODY;
    const x = BenchSupply.TERMINALS[index]?.x ?? 0;
    return new Vector3(x, BenchSupply.TERMINAL.y, depth / 2 + BenchSupply.TERMINAL.depth);
  }

  /**
   * Muestra la lectura (redibuja solo si cambió el número) y enciende o apaga el LED y los displays.
   *
   * @param reading Lectura de la fuente.
   * @param reading.volts Voltaje.
   * @param reading.amps Corriente.
   * @param reading.on Si está encendida.
   * @param level Brillo general (encendido de la escena).
   */
  public show(reading: { volts: number; amps: number; on: boolean }, level: number): void {
    const { volts, amps, on } = reading;
    const text = `${String(on)}${amps.toFixed(BenchSupply.DECIMALS)}`;
    if (text !== this.shown) {
      this.shown = text;
      this.replace(this.displays.supply(volts, amps, on));
    }
    const { glow, off } = BenchSupply.SCREEN;
    this.screen.color.setScalar(Math.max(level * glow, off));
    const led = BenchSupply.LED;
    this.led.color.set(led.color).multiplyScalar(on ? Math.max(level * led.glow, led.off) : led.off);
  }

  /**
   * Resalta el gabinete señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = BenchSupply.HIGHLIGHT;
    this.body.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Libera la textura del display.
   */
  public dispose(): void {
    this.screen.map?.dispose();
  }

  /**
   * Frente oscuro con los displays.
   */
  private buildPanel(): void {
    const { width, height, depth } = BenchSupply.BODY;
    const { color, inset, lift } = BenchSupply.PANEL;
    const panel = new Mesh(
      new PlaneGeometry(width - inset, height - inset),
      new MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    panel.position.z = depth / 2 + lift;
    const display = BenchSupply.DISPLAY;
    const screen = new Mesh(new PlaneGeometry(display.width, display.height), this.screen);
    screen.position.set(display.x, display.y, depth / 2 + lift * 2);
    this.group.add(panel, screen);
  }

  /**
   * Perillas, bornes, interruptor y LED de encendido.
   */
  private buildControls(): void {
    const front = BenchSupply.BODY.depth / 2;
    const knob = BenchSupply.KNOB;
    const dark = new MeshStandardMaterial({ color: knob.color, roughness: 0.5 });
    BenchSupply.KNOBS.forEach(({ x }) => {
      this.cylinder({ radius: knob.radius, depth: knob.depth }, { x, y: knob.y, z: front }, dark);
    });
    const post = BenchSupply.TERMINAL;
    BenchSupply.TERMINALS.forEach(({ x, color }) => {
      const material = new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
      this.cylinder({ radius: post.radius, depth: post.depth }, { x, y: post.y, z: front }, material);
    });
    const toggle = BenchSupply.SWITCH;
    const rocker = new Mesh(new BoxGeometry(toggle.width, toggle.height, toggle.depth), dark);
    rocker.position.set(toggle.x, toggle.y, front + toggle.depth / 2);
    const { size, x } = BenchSupply.LED;
    const led = new Mesh(new BoxGeometry(size, size, size), this.led);
    led.position.set(x, toggle.y, front + size / 2);
    this.group.add(rocker, led);
  }

  /**
   * Agrega un cilindro que sale del frente.
   *
   * @param size Radio y largo.
   * @param size.radius Radio.
   * @param size.depth Largo.
   * @param at Centro de su base en el frente.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   * @param at.z Profundidad del frente.
   * @param material Material.
   */
  private cylinder(
    size: { radius: number; depth: number },
    at: { x: number; y: number; z: number },
    material: MeshStandardMaterial,
  ): void {
    const mesh = new Mesh(
      new CylinderGeometry(size.radius, size.radius, size.depth, GeometryDetail.Low),
      material,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(at.x, at.y, at.z + size.depth / 2);
    this.group.add(mesh);
  }

  /**
   * Cambia la textura del display y libera la anterior.
   *
   * @param texture Textura nueva.
   */
  private replace(texture: Texture): void {
    this.screen.map?.dispose();
    this.screen.map = texture;
    this.screen.needsUpdate = true;
  }
}
