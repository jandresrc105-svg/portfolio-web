import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { RadioControl } from '../../models/RadioControl';
import type { RadioHandle } from '../../models/RadioHandle';
import type { RadioState } from '../../models/RadioState';
import type { RadioPanelArt } from './RadioPanelArt';

/**
 * Placa de RF expuesta del receptor, sobre separadores de latón: dos bobinas de cobre al aire (el tanque LC
 * de entrada), un toroide de ferrita bobinado (el transformador de la antena), el capacitor variable de
 * placas cuyo rotor gira con la sintonía, el cristal del oscilador local, el chip del SDR, un LED de
 * enganche y el conector SMA donde entra la antena. Se construye con origen en el centro de la placa,
 * sobre la cubierta del banco.
 */
export class RadioRfBoard {
  private static readonly PCB = { width: 0.2, depth: 0.13, thickness: 0.0035, lift: 0.012 };
  private static readonly LOOK = { background: '#1d6a3c', ink: '#e8f2ea', copper: '#c9a24a' };
  private static readonly STANDOFF = { radius: 0.004, inset: 0.01, color: 0xc9a24a };
  private static readonly COPPER = 0xc8753a;
  private static readonly COILS = [{ z: -0.03 }, { z: 0.015 }];
  private static readonly COIL = {
    x: -0.06,
    radius: 0.008,
    wire: 0.0011,
    turns: 7,
    pitch: 0.0034,
    steps: 12,
  };
  private static readonly TOROID = {
    x: -0.015,
    z: 0.04,
    radius: 0.011,
    tube: 0.0045,
    windings: 16,
    wire: 0.0008,
  };
  private static readonly FERRITE = 0x2b2b2e;
  private static readonly CAPACITOR = {
    x: 0.035,
    z: -0.02,
    radius: 0.019,
    plates: 6,
    gap: 0.005,
    plate: 0.0008,
  };
  private static readonly SHAFT = { radius: 0.002, extra: 0.02, frame: 0.002, lift: 0.004 };
  private static readonly ALUMINUM = 0xb9bec4;
  private static readonly CRYSTAL = { x: 0.035, z: 0.042, width: 0.011, height: 0.0095, depth: 0.0045 };
  private static readonly CHIP = { x: 0.075, z: 0.035, size: 0.016, height: 0.0025, color: 0x111214 };
  private static readonly LED = {
    x: 0.085,
    z: -0.05,
    size: 0.004,
    height: 0.002,
    color: 0x3dff7a,
    glow: 4,
    off: 0.05,
  };
  private static readonly SMA = {
    z: -0.02,
    nut: 0.0055,
    nutLength: 0.006,
    barrel: 0.0033,
    length: 0.012,
    lift: 0.004,
  };
  private static readonly GOLD = 0xd4a640;
  private static readonly HEX = 6;
  private static readonly HEADER = { x: -0.05, width: 0.02, height: 0.006, depth: 0.006, color: 0x111214 };
  private static readonly ROTOR_RATE = 8;
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.3 };
  private static readonly LABELS = [
    { text: 'RF FRONT-END · 40 m', x: -0.03, y: 0.056, size: 11 },
    { text: 'L1', x: -0.088, y: 0.03, size: 10 },
    { text: 'L2', x: -0.088, y: -0.015, size: 10 },
    { text: 'T1', x: -0.015, y: -0.058, size: 10 },
    { text: 'C1 VAR', x: 0.07, y: 0.045, size: 10 },
    { text: 'Y1 7.000', x: 0.035, y: -0.058, size: 9 },
    { text: 'U1 SDR', x: 0.075, y: -0.055, size: 9 },
    { text: 'ANT', x: 0.086, y: 0.004, size: 10 },
  ];
  private static readonly TRACES = [
    [
      { x: -0.045, y: 0.03 },
      { x: 0.01, y: 0.03 },
      { x: 0.01, y: 0.02 },
    ],
    [
      { x: -0.045, y: -0.015 },
      { x: -0.015, y: -0.015 },
      { x: -0.015, y: -0.026 },
    ],
    [
      { x: 0.06, y: 0.02 },
      { x: 0.075, y: 0.02 },
      { x: 0.075, y: -0.026 },
    ],
    [
      { x: 0.1, y: 0.02 },
      { x: 0.075, y: 0.02 },
    ],
    [
      { x: 0.035, y: -0.034 },
      { x: 0.035, y: -0.01 },
    ],
    [
      { x: -0.095, y: -0.06 },
      { x: 0.095, y: -0.06 },
      { x: 0.095, y: 0.06 },
      { x: -0.095, y: 0.06 },
      { x: -0.095, y: -0.06 },
    ],
  ];

  public readonly group = new Group();

  private readonly board = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, envMapIntensity: 0.3 });
  private readonly copper = new MeshStandardMaterial({ roughness: 0.3, metalness: 1, envMapIntensity: 0.6 });
  private readonly aluminum = new MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.9,
    envMapIntensity: 0.5,
  });
  private readonly gold = new MeshStandardMaterial({ roughness: 0.3, metalness: 1, envMapIntensity: 0.6 });
  private readonly dark = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 });
  private readonly led = new MeshBasicMaterial({ toneMapped: false });
  private readonly rotor = new Group();
  private readonly handles: RadioHandle[] = [];
  private angle = 0;

  /**
   * Crea la placa.
   *
   * @param art Pintor de la serigrafía.
   */
  public constructor(private readonly art: RadioPanelArt) {
    this.copper.color.set(RadioRfBoard.COPPER);
    this.aluminum.color.set(RadioRfBoard.ALUMINUM);
    this.gold.color.set(RadioRfBoard.GOLD);
    this.dark.color.set(RadioRfBoard.CHIP.color);
  }

  /**
   * Controles de la placa.
   *
   * @returns La placa, que muestra el cálculo del tanque LC.
   */
  public get controls(): readonly RadioHandle[] {
    return this.handles;
  }

  /**
   * Altura de la cara de la placa sobre la cubierta.
   *
   * @returns Metros.
   */
  private static get top(): number {
    const { thickness, lift } = RadioRfBoard.PCB;
    return lift + thickness;
  }

  /**
   * Construye la placa y sus componentes.
   *
   * @returns Textura de la serigrafía (para liberarla con la pieza).
   */
  public build(): Texture {
    const texture = this.buildBoard();
    this.buildCoils();
    this.buildToroid();
    this.buildCapacitor();
    this.buildParts();
    this.buildConnector();
    return texture;
  }

  /**
   * Punta del conector SMA, donde se enchufa el coaxial de la antena.
   *
   * @returns Punto en el espacio del grupo.
   */
  public antennaPort(): Vector3 {
    const { nutLength, length, lift, z } = RadioRfBoard.SMA;
    return new Vector3(RadioRfBoard.PCB.width / 2 + nutLength + length, RadioRfBoard.top + lift, z);
  }

  /**
   * Conector de salida hacia el receptor (borde trasero).
   *
   * @returns Punto en el espacio del grupo.
   */
  public outputPort(): Vector3 {
    const { x, height } = RadioRfBoard.HEADER;
    return new Vector3(x, RadioRfBoard.top + height / 2, -RadioRfBoard.PCB.depth / 2);
  }

  /**
   * Gira el rotor del capacitor variable con la sintonía y enciende el LED de enganche.
   *
   * @param state Estado del receptor.
   * @param level Brillo general.
   * @param delta Segundos desde el frame anterior.
   */
  public show(state: RadioState, level: number, delta: number): void {
    this.angle += (state.dial * Math.PI - this.angle) * Math.min(RadioRfBoard.ROTOR_RATE * delta, 1);
    this.rotor.rotation.x = this.angle;
    const { color, glow, off } = RadioRfBoard.LED;
    const lit = state.on && state.locked;
    this.led.color.set(color).multiplyScalar(lit ? Math.max(level * glow, off) : off);
  }

  /**
   * Resalta la placa.
   *
   * @param id Control señalado, o `null`.
   */
  public highlight(id: string | null): void {
    const { color, strength } = RadioRfBoard.HIGHLIGHT;
    this.board.emissive.set(color).multiplyScalar(id === RadioControl.Board ? strength : 0);
  }

  /**
   * Placa con su serigrafía y los separadores.
   *
   * @returns Textura.
   */
  private buildBoard(): Texture {
    const { width, depth, thickness, lift } = RadioRfBoard.PCB;
    const texture = this.art.plate({ width, height: depth }, RadioRfBoard.LOOK, {
      labels: RadioRfBoard.LABELS,
      traces: RadioRfBoard.TRACES,
    });
    this.board.map = texture;
    const pcb = new Mesh(new BoxGeometry(width, thickness, depth), this.board);
    pcb.position.y = lift + thickness / 2;
    this.group.add(pcb, this.standoffs());
    this.handles.push({ id: RadioControl.Board, hitArea: pcb, glow: this.board });
    return texture;
  }

  /**
   * Separadores de latón en las cuatro esquinas.
   *
   * @returns Separadores instanciados.
   */
  private standoffs(): InstancedMesh {
    const { width, depth, lift } = RadioRfBoard.PCB;
    const { radius, inset, color } = RadioRfBoard.STANDOFF;
    const posts = new InstancedMesh(
      new CylinderGeometry(radius, radius, lift, GeometryDetail.Thin),
      new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.9 }),
      [-1, 1].length * 2,
    );
    const dummy = new Object3D();
    [-1, 1].forEach((sx, row) => {
      [-1, 1].forEach((sz, column) => {
        dummy.position.set(sx * (width / 2 - inset), lift / 2, sz * (depth / 2 - inset));
        dummy.updateMatrix();
        posts.setMatrixAt(row * 2 + column, dummy.matrix);
      });
    });
    return posts;
  }

  /**
   * Bobinas de cobre al aire, acostadas a lo largo de x.
   */
  private buildCoils(): void {
    const { x, radius, wire, turns, pitch, steps } = RadioRfBoard.COIL;
    const length = turns * pitch;
    const points = Array.from({ length: turns * steps + 1 }, (_value, index) => {
      const angle = (index / steps) * Math.PI * 2;
      return new Vector3(
        -length / 2 + (index / (turns * steps)) * length,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
    });
    const geometry = new TubeGeometry(new CatmullRomCurve3(points), turns * steps, wire, GeometryDetail.Wire);
    RadioRfBoard.COILS.forEach(({ z }) => {
      const coil = new Mesh(geometry, this.copper);
      coil.position.set(x, RadioRfBoard.top + radius + wire, z);
      this.group.add(coil);
    });
  }

  /**
   * Toroide de ferrita acostado con sus vueltas de alambre.
   */
  private buildToroid(): void {
    const { x, z, radius, tube } = RadioRfBoard.TOROID;
    const y = RadioRfBoard.top + tube;
    const core = new Mesh(
      new TorusGeometry(radius, tube, GeometryDetail.Low, GeometryDetail.Medium),
      new MeshStandardMaterial({ color: RadioRfBoard.FERRITE, roughness: 0.8 }),
    );
    core.rotation.x = Math.PI / 2;
    core.position.set(x, y, z);
    this.group.add(core, this.windings(y));
  }

  /**
   * Vueltas de alambre alrededor del toroide.
   *
   * @param y Altura del centro del toroide.
   * @returns Vueltas instanciadas.
   */
  private windings(y: number): InstancedMesh {
    const { x, z, radius, tube, windings, wire } = RadioRfBoard.TOROID;
    const turns = new InstancedMesh(
      new TorusGeometry(tube + wire, wire, GeometryDetail.Thin, GeometryDetail.Low),
      this.copper,
      windings,
    );
    const dummy = new Object3D();
    for (let index = 0; index < windings; index++) {
      const angle = (index / windings) * Math.PI * 2;
      dummy.position.set(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius);
      dummy.rotation.set(0, -angle, 0);
      dummy.updateMatrix();
      turns.setMatrixAt(index, dummy.matrix);
    }
    return turns;
  }

  /**
   * Capacitor variable: estator fijo y rotor de medias lunas que entra y sale al sintonizar (más placas
   * enfrentadas = más capacidad = frecuencia más baja).
   */
  private buildCapacitor(): void {
    const { x, z, radius, plates, gap } = RadioRfBoard.CAPACITOR;
    const { radius: shaft, extra, lift } = RadioRfBoard.SHAFT;
    const y = RadioRfBoard.top + radius + lift;
    const span = plates * gap;
    const stator = this.plates(plates - 1, gap / 2);
    stator.position.set(x - span / 2, y, z);
    this.rotor.add(this.plates(plates, 0));
    this.rotor.position.set(x - span / 2, y, z);
    const axle = new Mesh(
      new CylinderGeometry(shaft, shaft, span + extra, GeometryDetail.Thin),
      this.aluminum,
    );
    axle.rotation.z = Math.PI / 2;
    axle.position.set(x, y, z);
    this.group.add(stator, this.rotor, axle);
    this.buildFrame(y, span);
  }

  /**
   * Placas de los extremos del capacitor, que sostienen el eje.
   *
   * @param y Altura del eje.
   * @param span Largo del juego de placas.
   */
  private buildFrame(y: number, span: number): void {
    const { x, z, radius } = RadioRfBoard.CAPACITOR;
    const { frame, lift } = RadioRfBoard.SHAFT;
    const geometry = new BoxGeometry(frame, radius * 2 + lift, radius * 2);
    [-1, 1].forEach((side) => {
      const end = new Mesh(geometry, this.aluminum);
      end.position.set(x + side * (span / 2 + frame), y - lift / 2, z);
      this.group.add(end);
    });
  }

  /**
   * Juego de placas en media luna, paralelas al plano yz.
   *
   * @param count Número de placas.
   * @param offset Corrimiento en x de la primera.
   * @returns Placas instanciadas.
   */
  private plates(count: number, offset: number): InstancedMesh {
    const { radius, gap, plate } = RadioRfBoard.CAPACITOR;
    const geometry = new CylinderGeometry(radius, radius, plate, GeometryDetail.Medium, 1, false, 0, Math.PI);
    geometry.rotateZ(Math.PI / 2);
    const mesh = new InstancedMesh(geometry, this.aluminum, count);
    const dummy = new Object3D();
    for (let index = 0; index < count; index++) {
      dummy.position.set(offset + index * gap, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    return mesh;
  }

  /**
   * Cristal, chip del SDR, LED y conector de salida.
   */
  private buildParts(): void {
    const top = RadioRfBoard.top;
    const crystal = RadioRfBoard.CRYSTAL;
    const can = new Mesh(new BoxGeometry(crystal.width, crystal.height, crystal.depth), this.aluminum);
    can.position.set(crystal.x, top + crystal.height / 2, crystal.z);
    const chip = RadioRfBoard.CHIP;
    const body = new Mesh(new BoxGeometry(chip.size, chip.height, chip.size), this.dark);
    body.position.set(chip.x, top + chip.height / 2, chip.z);
    const led = RadioRfBoard.LED;
    const light = new Mesh(new BoxGeometry(led.size, led.height, led.size), this.led);
    light.position.set(led.x, top + led.height / 2, led.z);
    const header = RadioRfBoard.HEADER;
    const socket = new Mesh(new BoxGeometry(header.width, header.height, header.depth), this.dark);
    socket.position.set(header.x, top + header.height / 2, -RadioRfBoard.PCB.depth / 2 + header.depth / 2);
    this.group.add(can, body, light, socket);
  }

  /**
   * Conector SMA dorado en el borde derecho: tuerca hexagonal y cuerpo roscado.
   */
  private buildConnector(): void {
    const { z, nut, nutLength, barrel, length, lift } = RadioRfBoard.SMA;
    const edge = RadioRfBoard.PCB.width / 2;
    const y = RadioRfBoard.top + lift;
    const hex = new Mesh(new CylinderGeometry(nut, nut, nutLength, RadioRfBoard.HEX), this.gold);
    hex.rotation.z = Math.PI / 2;
    hex.position.set(edge + nutLength / 2, y, z);
    const body = new Mesh(new CylinderGeometry(barrel, barrel, length, GeometryDetail.Low), this.gold);
    body.rotation.z = Math.PI / 2;
    body.position.set(edge + nutLength + length / 2, y, z);
    this.group.add(hex, body);
  }
}
