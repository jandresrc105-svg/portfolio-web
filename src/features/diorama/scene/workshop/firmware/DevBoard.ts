import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Placa de desarrollo tipo ESP32 DevKit acostada sobre la protoboard: PCB negro con serigrafía, módulo
 * ESP32 con blindaje metálico y antena, chip conversor USB-serie, cristal, conector micro USB, dos filas de
 * pines, botones EN (reinicio) y BOOT y cuatro LEDs: encendido, TX, RX y el LED del GPIO2. El grupo tiene
 * origen en el centro, a la altura de la protoboard; el USB queda hacia -x.
 */
export class DevBoard {
  public static readonly PCB = { width: 0.1, height: 0.003, depth: 0.05, y: 0.012 };

  private static readonly HEADER = { width: 0.094, height: 0.012, depth: 0.005, z: 0.021, color: 0x121214 };
  private static readonly PIN = { size: 0.0012, height: 0.004, count: 15, color: 0xd9b54a };
  private static readonly MODULE = { width: 0.046, depth: 0.034, height: 0.0012, x: 0.026, color: 0x14202c };
  private static readonly SHIELD = { width: 0.03, depth: 0.028, height: 0.003, x: 0.02 };
  private static readonly CHIP = { size: 0.007, height: 0.0015, x: -0.02, z: 0.004, color: 0x0c0c0e };
  private static readonly CRYSTAL = { radius: 0.0022, height: 0.0028, stretch: 2, x: -0.03, z: -0.01 };
  private static readonly USB = { width: 0.008, height: 0.003, depth: 0.0075, x: -0.047 };
  private static readonly BUTTON = { width: 0.005, height: 0.0018, depth: 0.004, cap: 0.0014, x: -0.04 };
  private static readonly BUTTONS = [{ z: 0.014 }, { z: -0.014 }];
  private static readonly RESET_HIT = { width: 0.02, height: 0.016, depth: 0.018 };
  private static readonly LED = { width: 0.0026, height: 0.0012, depth: 0.0016, x: -0.028, spacing: 0.0045 };
  private static readonly LEDS = {
    power: { color: 0xff3030, z: -0.006 },
    tx: { color: 0xffb020, z: -0.0015 },
    rx: { color: 0x40ff70, z: 0.003 },
    io2: { color: 0x3a8bff, z: 0.0075 },
  };
  private static readonly GLOW = { on: 4, off: 0.04 };
  private static readonly LIFT = 0.0002;
  private static readonly CAP_LIFT = 1.2;
  private static readonly COLORS = { button: 0x1a1a1c, pcb: 0x10161d };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.6 };

  public readonly group = new Group();
  public readonly resetArea: Mesh;

  private readonly button = new MeshStandardMaterial({ color: DevBoard.COLORS.button, roughness: 0.5 });
  private readonly leds = {
    power: new MeshBasicMaterial({ toneMapped: false }),
    tx: new MeshBasicMaterial({ toneMapped: false }),
    rx: new MeshBasicMaterial({ toneMapped: false }),
    io2: new MeshBasicMaterial({ toneMapped: false }),
  };
  private readonly metal: MeshStandardMaterial;

  /**
   * Crea la placa.
   *
   * @param metal Material metálico compartido (blindaje, cristal, USB).
   */
  public constructor(metal: MeshStandardMaterial) {
    this.metal = metal;
    const { width, height, depth } = DevBoard.RESET_HIT;
    this.resetArea = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshBasicMaterial({ visible: false }),
    );
  }

  /**
   * Construye la placa.
   *
   * @param silk Serigrafía del PCB.
   * @returns Grupo de la placa.
   */
  public build(silk: Texture): Group {
    this.buildPcb(silk);
    this.buildHeaders();
    this.buildModule();
    this.buildParts();
    this.buildButtons();
    this.buildLeds();
    return this.group;
  }

  /**
   * Punta del conector USB, de donde sale el cable a la laptop.
   *
   * @returns Punto en el espacio del grupo.
   */
  public usbPort(): Vector3 {
    const { x, width } = DevBoard.USB;
    return new Vector3(x - width / 2, DevBoard.top(), 0);
  }

  /**
   * Enciende los LEDs de la placa.
   *
   * @param lights Estado de cada LED.
   * @param lights.tx Transmisión serie.
   * @param lights.rx Recepción serie.
   * @param lights.io2 LED del GPIO2 (`LED_BUILTIN`).
   * @param level Brillo general.
   */
  public show(lights: { tx: boolean; rx: boolean; io2: boolean }, level: number): void {
    this.light('power', true, level);
    this.light('tx', lights.tx, level);
    this.light('rx', lights.rx, level);
    this.light('io2', lights.io2, level);
  }

  /**
   * Resalta el botón de reinicio.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = DevBoard.HIGHLIGHT;
    this.button.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * PCB con su serigrafía.
   *
   * @param silk Serigrafía.
   */
  private buildPcb(silk: Texture): void {
    const { width, height, depth, y } = DevBoard.PCB;
    const pcb = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color: DevBoard.COLORS.pcb, roughness: 0.6 }),
    );
    pcb.position.y = y + height / 2;
    const face = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshStandardMaterial({ map: silk, roughness: 0.6 }),
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = DevBoard.top() + DevBoard.LIFT;
    this.group.add(pcb, face);
  }

  /**
   * Tiras negras de los pines (sostienen la placa) y las puntas doradas encima.
   */
  private buildHeaders(): void {
    const header = DevBoard.HEADER;
    const plastic = new MeshStandardMaterial({ color: header.color, roughness: 0.7 });
    const pin = DevBoard.PIN;
    const tips = new InstancedMesh(
      new BoxGeometry(pin.size, pin.height, pin.size),
      new MeshStandardMaterial({ color: pin.color, roughness: 0.3, metalness: 0.8 }),
      pin.count * 2,
    );
    [-header.z, header.z].forEach((z, side) => {
      const strip = new Mesh(new BoxGeometry(header.width, header.height, header.depth), plastic);
      strip.position.set(0, header.height / 2, z);
      this.group.add(strip);
      DevBoard.placePins(tips, side, z);
    });
    this.group.add(tips);
  }

  /**
   * Módulo ESP32: PCB azul oscuro con el blindaje metálico encima (la antena queda al descubierto).
   */
  private buildModule(): void {
    const module = DevBoard.MODULE;
    const base = new Mesh(
      new BoxGeometry(module.width, module.height, module.depth),
      new MeshStandardMaterial({ color: module.color, roughness: 0.5 }),
    );
    base.position.set(module.x, DevBoard.top() + module.height / 2, 0);
    const shield = DevBoard.SHIELD;
    const can = new Mesh(new BoxGeometry(shield.width, shield.height, shield.depth), this.metal);
    can.position.set(shield.x, DevBoard.top() + module.height + shield.height / 2, 0);
    this.group.add(base, can);
  }

  /**
   * Conversor USB-serie, cristal y conector micro USB.
   */
  private buildParts(): void {
    const top = DevBoard.top();
    const chip = DevBoard.CHIP;
    const ic = new Mesh(
      new BoxGeometry(chip.size, chip.height, chip.size),
      new MeshStandardMaterial({ color: chip.color, roughness: 0.4 }),
    );
    ic.position.set(chip.x, top + chip.height / 2, chip.z);
    const crystal = DevBoard.CRYSTAL;
    const can = new Mesh(
      new CylinderGeometry(crystal.radius, crystal.radius, crystal.height, GeometryDetail.Low),
      this.metal,
    );
    can.scale.x = crystal.stretch;
    can.position.set(crystal.x, top + crystal.height / 2, crystal.z);
    const usb = DevBoard.USB;
    const port = new Mesh(new BoxGeometry(usb.width, usb.height, usb.depth), this.metal);
    port.position.set(usb.x, top + usb.height / 2, 0);
    this.group.add(ic, can, port);
  }

  /**
   * Botones EN (reinicio, con su zona de clic) y BOOT.
   */
  private buildButtons(): void {
    const top = DevBoard.top();
    const { width, height, depth, cap, x } = DevBoard.BUTTON;
    DevBoard.BUTTONS.forEach(({ z }) => {
      const body = new Mesh(new BoxGeometry(width, height, depth), this.metal);
      body.position.set(x, top + height / 2, z);
      const knob = new Mesh(new CylinderGeometry(cap, cap, height, GeometryDetail.Low), this.button);
      knob.position.set(x, top + height * DevBoard.CAP_LIFT, z);
      this.group.add(body, knob);
    });
    const reset = DevBoard.BUTTONS[0] ?? { z: 0 };
    this.resetArea.position.set(x, top + DevBoard.RESET_HIT.height / 2, reset.z);
    this.group.add(this.resetArea);
  }

  /**
   * LEDs SMD de la placa.
   */
  private buildLeds(): void {
    const { width, height, depth, x } = DevBoard.LED;
    const geometry = new BoxGeometry(width, height, depth);
    (Object.keys(DevBoard.LEDS) as (keyof typeof DevBoard.LEDS)[]).forEach((name) => {
      const led = new Mesh(geometry, this.leds[name]);
      led.position.set(x, DevBoard.top() + height / 2, DevBoard.LEDS[name].z);
      this.group.add(led);
    });
  }

  /**
   * Enciende o apaga un LED.
   *
   * @param name LED.
   * @param on Si está encendido.
   * @param level Brillo general.
   */
  private light(name: keyof typeof DevBoard.LEDS, on: boolean, level: number): void {
    const { on: glow, off } = DevBoard.GLOW;
    this.leds[name].color
      .set(DevBoard.LEDS[name].color)
      .multiplyScalar(on ? Math.max(glow * level, off) : off);
  }

  /**
   * Ubica las puntas doradas de una fila de pines.
   *
   * @param tips Puntas de todos los pines.
   * @param side Fila (0 o 1).
   * @param z Profundidad de la fila.
   */
  private static placePins(tips: InstancedMesh, side: number, z: number): void {
    const { width } = DevBoard.HEADER;
    const { count } = DevBoard.PIN;
    const matrix = new Matrix4();
    for (let index = 0; index < count; index++) {
      const x = -width / 2 + (width / count) * (index + 0.5);
      tips.setMatrixAt(side * count + index, matrix.makeTranslation(x, DevBoard.top(), z));
    }
  }

  /**
   * Altura de la cara superior del PCB.
   *
   * @returns Altura en el espacio del grupo.
   */
  private static top(): number {
    const { y, height } = DevBoard.PCB;
    return y + height;
  }
}
