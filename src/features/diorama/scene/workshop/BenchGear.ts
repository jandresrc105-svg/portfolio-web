import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
  type Texture,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { BenchCable } from './BenchCable';
import type { BenchDisplays } from './BenchDisplays';
import type { WorkshopArt } from './WorkshopArt';

/**
 * Equipos menores del banco: la estación de soldadura con el cautín en su soporte, el multímetro con sus
 * puntas apoyadas en la placa de prueba y una protoboard con un 555 astable que hace parpadear un LED
 * mientras la fuente está encendida. Se construye en el espacio del banco.
 */
export class BenchGear {
  private static readonly STATION = {
    x: 0.52,
    z: -0.86,
    width: 0.15,
    height: 0.09,
    depth: 0.13,
    color: 0x1f4f9a,
  };
  private static readonly STATION_SCREEN = { width: 0.08, height: 0.032, y: 0.015, glow: 1.3, off: 0.06 };
  private static readonly IRON = {
    tip: { x: 0.5, y: 0.935, z: -0.7 },
    neck: { x: 0.54, y: 0.965, z: -0.66 },
    end: { x: 0.62, y: 1.03, z: -0.58 },
    shaft: 0.004,
    grip: 0.012,
    color: 0x2c6fdc,
    steel: 0xc9ced2,
    hot: 0xff6a2a,
    heat: 1.4,
  };
  private static readonly STAND = { width: 0.07, height: 0.014, depth: 0.09, x: 0.57, z: -0.64 };
  private static readonly METER = {
    x: 0.06,
    y: 0.014,
    z: -0.36,
    turn: 0.35,
    width: 0.09,
    depth: 0.16,
    color: 0xf2c230,
  };
  private static readonly METER_FACE = { width: 0.076, depth: 0.14, color: 0x22262b, lift: 0.001 };
  private static readonly METER_LCD = { width: 0.064, height: 0.03, z: -0.045, glow: 1.1 };
  private static readonly DIAL = { radius: 0.018, height: 0.006, z: 0.022, color: 0x121315 };
  private static readonly PROBES = [
    { color: 0xc8282d, from: { x: 0.07, z: -0.27 }, to: { x: 0.23, y: 0.965, z: -0.44 } },
    { color: 0x141518, from: { x: 0.09, z: -0.275 }, to: { x: 0.24, y: 0.975, z: -0.51 } },
  ];
  private static readonly PROBE = { radius: 0.0035, sag: 0.06 };
  private static readonly BREADBOARD = {
    x: 0.42,
    z: -0.34,
    turn: -0.12,
    width: 0.2,
    height: 0.012,
    depth: 0.07,
    color: 0xb9b4a8,
  };
  private static readonly PLASTIC = { roughness: 0.85, envMapIntensity: 0.15 };
  private static readonly CHIP = { width: 0.024, height: 0.008, depth: 0.016, x: -0.02, color: 0x121216 };
  private static readonly CAPACITOR = { radius: 0.006, height: 0.014, x: 0.01, z: 0.018, color: 0x2f5fd0 };
  private static readonly BLINK_LED = {
    radius: 0.007,
    x: 0.045,
    z: -0.012,
    color: 0xff3326,
    glow: 7,
    off: 0.08,
  };
  private static readonly JUMPERS = [
    { x: -0.06, z: 0.02, length: 0.04, turn: 0.2, color: 0xe0b22a },
    { x: 0.03, z: -0.02, length: 0.03, turn: 1.4, color: 0x3fd070 },
    { x: 0.07, z: 0.015, length: 0.035, turn: -0.4, color: 0xc0342f },
  ];
  private static readonly JUMPER = { size: 0.003 };
  private static readonly BLINK = { rate: 1.2, duty: 0.55 };
  private static readonly DECIMALS = 2;

  public readonly group = new Group();

  private readonly cables = new BenchCable();
  private readonly lcd = new MeshBasicMaterial({ toneMapped: false });
  private readonly stationScreen = new MeshBasicMaterial({ toneMapped: false });
  private readonly tip = new MeshBasicMaterial({ toneMapped: false });
  private readonly blinker = new MeshBasicMaterial({ toneMapped: false });
  private shown = '';

  /**
   * Crea los equipos.
   *
   * @param top Altura de la cubierta del banco.
   * @param art Gráficas del taller (protoboard).
   * @param displays Pantallas de los equipos.
   */
  public constructor(
    private readonly top: number,
    private readonly art: WorkshopArt,
    private readonly displays: BenchDisplays,
  ) {}

  /**
   * Construye la estación, el cautín, el multímetro y la protoboard.
   *
   * @returns Grupo con los equipos.
   * @param own Registra una textura para liberarla con el banco.
   */
  public build(own: (texture: Texture) => Texture): Group {
    this.stationScreen.map = own(this.displays.station());
    this.buildStation();
    this.buildIron();
    this.buildMeter();
    this.buildProbes();
    this.buildBreadboard(own(this.art.breadboard()));
    return this.group;
  }

  /**
   * Muestra la tensión en el multímetro (redibuja solo si cambió) y hace parpadear el LED del 555.
   *
   * @param volts Tensión en la placa.
   * @param level Brillo general (encendido de la escena).
   * @param elapsed Segundos desde el inicio.
   */
  public update(volts: number, level: number, elapsed: number): void {
    const text = volts.toFixed(BenchGear.DECIMALS);
    if (text !== this.shown) {
      this.shown = text;
      this.show(this.displays.meter(volts, volts > 0, this.lcd.map));
    }
    const { rate, duty } = BenchGear.BLINK;
    const on = volts > 0 && (elapsed * rate) % 1 < duty;
    const led = BenchGear.BLINK_LED;
    this.blinker.color.set(led.color).multiplyScalar(on ? Math.max(level * led.glow, led.off) : led.off);
    this.lcd.color.setScalar(Math.max(level * BenchGear.METER_LCD.glow, BenchGear.STATION_SCREEN.off));
    const screen = BenchGear.STATION_SCREEN;
    this.stationScreen.color.setScalar(Math.max(level * screen.glow, screen.off));
    this.tip.color.set(BenchGear.IRON.hot).multiplyScalar(Math.max(level * BenchGear.IRON.heat, screen.off));
  }

  /**
   * Libera la textura del multímetro.
   */
  public dispose(): void {
    this.lcd.map?.dispose();
  }
  /**
   * Pone una textura en el display del multímetro (si se repintó la misma, no hace nada).
   *
   * @param texture Textura.
   */
  private show(texture: Texture): void {
    if (texture === this.lcd.map) {
      return;
    }
    this.lcd.map?.dispose();
    this.lcd.map = texture;
    this.lcd.needsUpdate = true;
  }

  /**
   * Estación de soldadura con su display de temperatura.
   */
  private buildStation(): void {
    const { x, z, width, height, depth, color } = BenchGear.STATION;
    const body = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3 });
    this.box({ x: width, y: height, z: depth }, { x, y: this.top + height / 2, z }, body);
    const screen = BenchGear.STATION_SCREEN;
    const display = new Mesh(new PlaneGeometry(screen.width, screen.height), this.stationScreen);
    display.position.set(x, this.top + height / 2 + screen.y, z + depth / 2 + BenchGear.METER_FACE.lift);
    this.group.add(display);
  }

  /**
   * Soporte y cautín: punta incandescente, vástago metálico y mango azul.
   */
  private buildIron(): void {
    const { tip, neck, end, shaft, grip, color, steel: chrome } = BenchGear.IRON;
    const stand = BenchGear.STAND;
    const dark = new MeshStandardMaterial({ color: BenchGear.DIAL.color, roughness: 0.5 });
    this.box(
      { x: stand.width, y: stand.height, z: stand.depth },
      { x: stand.x, y: this.top + stand.height / 2, z: stand.z },
      dark,
    );
    const steel = new MeshStandardMaterial({ color: chrome, roughness: 0.3, metalness: 0.9 });
    const handle = new MeshStandardMaterial({ color, roughness: 0.5 });
    const glow = new Mesh(new SphereGeometry(shaft * 2, GeometryDetail.Low, GeometryDetail.Low), this.tip);
    glow.position.copy(tip);
    this.group.add(this.cables.rod(tip, neck, shaft, steel), this.cables.rod(neck, end, grip, handle), glow);
  }

  /**
   * Multímetro amarillo acostado con su pantalla LCD y el selector.
   */
  private buildMeter(): void {
    const { x, y, z, turn, width, depth, color } = BenchGear.METER;
    const meter = new Group();
    const yellow = new MeshStandardMaterial({ color, roughness: 0.55 });
    meter.add(new Mesh(new BoxGeometry(width, y * 2, depth), yellow));
    this.buildMeterFace(meter, y);
    meter.position.set(x, this.top + y, z);
    meter.rotation.y = turn;
    this.group.add(meter);
  }

  /**
   * Cara del multímetro: panel oscuro, pantalla LCD y selector.
   *
   * @param meter Grupo del multímetro.
   * @param surface Altura de su cara superior.
   */
  private buildMeterFace(meter: Group, surface: number): void {
    const faceSize = BenchGear.METER_FACE;
    const face = this.flat(
      faceSize.width,
      faceSize.depth,
      new MeshStandardMaterial({ color: faceSize.color }),
    );
    face.position.y = surface + faceSize.lift;
    const lcd = BenchGear.METER_LCD;
    const screen = this.flat(lcd.width, lcd.height, this.lcd);
    screen.position.set(0, surface + faceSize.lift * 2, lcd.z);
    const dial = BenchGear.DIAL;
    const knob = new Mesh(
      new CylinderGeometry(dial.radius, dial.radius, dial.height, GeometryDetail.Medium),
      new MeshStandardMaterial({ color: dial.color }),
    );
    knob.position.set(0, surface + dial.height / 2, dial.z);
    meter.add(face, screen, knob);
  }

  /**
   * Cables de las puntas del multímetro hasta la placa del banco.
   */
  private buildProbes(): void {
    const { radius, sag } = BenchGear.PROBE;
    BenchGear.PROBES.forEach(({ color, from, to }) => {
      const material = new MeshStandardMaterial({ color, roughness: 0.5 });
      const start = { x: from.x, y: this.top + BenchGear.METER.y, z: from.z };
      const middle = { x: (from.x + to.x) / 2, y: this.top + radius, z: (from.z + to.z) / 2 + sag };
      this.group.add(this.cables.curve([start, middle, to], radius, material));
    });
  }

  /**
   * Protoboard con el 555, el condensador, el LED que parpadea y unos puentes de colores.
   *
   * @param texture Cara superior de la protoboard.
   */
  private buildBreadboard(texture: Texture): void {
    const { x, z, turn, width, height, depth, color } = BenchGear.BREADBOARD;
    const board = new Group();
    const { roughness, envMapIntensity } = BenchGear.PLASTIC;
    const body = new MeshStandardMaterial({ color, roughness, envMapIntensity });
    const face = new MeshStandardMaterial({ map: texture, roughness, envMapIntensity });
    board.add(new Mesh(new BoxGeometry(width, height, depth), [body, body, face, body, body, body]));
    this.buildCircuit(board, height / 2);
    board.position.set(x, this.top + height / 2, z);
    board.rotation.y = turn;
    this.group.add(board);
  }

  /**
   * Componentes montados en la protoboard.
   *
   * @param board Grupo de la protoboard.
   * @param surface Altura de su cara superior.
   */
  private buildCircuit(board: Group, surface: number): void {
    const chip = BenchGear.CHIP;
    const black = new MeshStandardMaterial({ color: chip.color, roughness: 0.4 });
    const ic = new Mesh(new BoxGeometry(chip.width, chip.height, chip.depth), black);
    ic.position.set(chip.x, surface + chip.height / 2, 0);
    const cap = BenchGear.CAPACITOR;
    const can = new Mesh(
      new CylinderGeometry(cap.radius, cap.radius, cap.height, GeometryDetail.Low),
      new MeshStandardMaterial({ color: cap.color, roughness: 0.4 }),
    );
    can.position.set(cap.x, surface + cap.height / 2, cap.z);
    const led = BenchGear.BLINK_LED;
    const bulb = new Mesh(
      new SphereGeometry(led.radius, GeometryDetail.Low, GeometryDetail.Low),
      this.blinker,
    );
    bulb.position.set(led.x, surface + led.radius * 2, led.z);
    board.add(ic, can, bulb);
    BenchGear.buildJumpers(board, surface);
  }

  /**
   * Plano acostado (mirando hacia arriba).
   *
   * @param width Ancho.
   * @param depth Profundidad.
   * @param material Material.
   * @returns Malla.
   */
  private flat(width: number, depth: number, material: Material): Mesh {
    const plane = new Mesh(new PlaneGeometry(width, depth), material);
    plane.rotation.x = -Math.PI / 2;
    return plane;
  }

  /**
   * Agrega una caja al grupo.
   *
   * @param size Dimensiones.
   * @param position Centro.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    this.group.add(mesh);
  }

  /**
   * Puentes de colores acostados sobre la protoboard.
   *
   * @param board Grupo de la protoboard.
   * @param surface Altura de su cara superior.
   */
  private static buildJumpers(board: Group, surface: number): void {
    const { size } = BenchGear.JUMPER;
    BenchGear.JUMPERS.forEach(({ x, z, length, turn, color }) => {
      const wire = new Mesh(new BoxGeometry(length, size, size), new MeshStandardMaterial({ color }));
      wire.position.set(x, surface + size / 2, z);
      wire.rotation.y = turn;
      board.add(wire);
    });
  }
}
