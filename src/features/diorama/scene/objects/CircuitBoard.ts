import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import type { PidLoopService } from '@shared/control/PidLoopService';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Placement } from '../../models/Placement';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { CircuitBoardArt } from './CircuitBoardArt';
import { CircuitBoardLayout } from './CircuitBoardLayout';
import { ElectronicParts } from './ElectronicParts';
import { ScopeProbe } from './ScopeProbe';
import { ServoMotor } from './ServoMotor';

/**
 * Placa del controlador PID sobre el banco del taller, en separadores de latón, con el motor que controla (la
 * planta)
 * y la sonda del osciloscopio enganchada en la salida del lazo. La aguja del motor sigue la misma respuesta
 * que dibuja el osciloscopio; el LED RUN late y el LED ERR brilla según el error del lazo.
 */
export class CircuitBoard extends SceneObject implements Updatable, Powerable {
  private static readonly FR4 = { color: 0xb9a56c, roughness: 0.75 };
  private static readonly STANDOFF = { radius: 0.0022, color: 0xc9a55a };
  private static readonly MOTOR = { x: 0.128, z: -0.004 };
  private static readonly WIRE = { radius: 0.0009, drop: 0.004, reach: 0.006, entry: 0.0045 };
  private static readonly LEDS = [
    { color: 0x3dff8f, glow: 2.2 },
    { color: 0x3fd8ff, glow: 2.6 },
    { color: 0xff4a3d, glow: 3.2 },
  ];
  private static readonly ANGLE = 0.9;
  private static readonly BLINK = { rate: 1.2, low: 0.25 };
  private static readonly ERROR_GAIN = 1.4;
  private static readonly TOP_OFFSET = 0.00005;
  private static readonly OFF_GLOW = 0.03;

  private readonly layout = new CircuitBoardLayout();
  private readonly parts = new ElectronicParts();
  private readonly painter: CircuitBoardArt;
  private readonly motor: ServoMotor;
  private readonly leds = CircuitBoard.LEDS.map(() => new MeshBasicMaterial());
  private level = 0;

  /**
   * Crea la placa.
   *
   * @param textures Fábrica de texturas.
   * @param loop Lazo PID que mueve el motor.
   * @param probeSource Devuelve, en el mundo, la punta del conector BNC donde nace la sonda.
   * @param placement Dónde queda sobre el banco del taller.
   */
  public constructor(
    textures: CanvasTextureFactory,
    private readonly loop: PidLoopService,
    private readonly probeSource: (target: Vector3) => Vector3,
    private readonly placement: Placement,
  ) {
    super();
    this.painter = new CircuitBoardArt(textures);
    this.motor = new ServoMotor(textures);
  }

  /**
   * Altura de la cara superior de la placa sobre la barra.
   *
   * @returns Metros.
   */
  private get surface(): number {
    const { thickness, standoff } = this.layout.board;
    return standoff + thickness;
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const output = this.loop.output(elapsed);
    const error = Math.abs(this.loop.setpoint(elapsed) - output);
    const { rate, low } = CircuitBoard.BLINK;
    const blink = Math.sin(elapsed * rate * Math.PI * 2) > 0 ? 1 : low;
    const levels = [1, blink, Math.min(error * CircuitBoard.ERROR_GAIN, 1)];
    this.leds.forEach((material, index) => {
      const { color, glow } = CircuitBoard.LEDS[index] ?? { color: 0, glow: 0 };
      const light = this.level * (levels[index] ?? 0) * glow;
      material.color.set(color).multiplyScalar(Math.max(light, CircuitBoard.OFF_GLOW));
    });
    this.motor.setAngle(output * CircuitBoard.ANGLE * this.level);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.root.position.copy(this.placement.position);
    this.root.rotation.y = this.placement.rotationY;
    this.root.updateMatrixWorld(true);
    this.buildBoard();
    this.buildParts();
    this.buildMotor();
    this.buildProbe();
  }

  /**
   * Placa de FR4 sobre separadores de latón, con su cara superior pintada.
   */
  private buildBoard(): void {
    const { width, depth, thickness, standoff } = this.layout.board;
    const edge = new MeshStandardMaterial(CircuitBoard.FR4);
    this.add(new Mesh(new BoxGeometry(width, thickness, depth), edge), {
      x: 0,
      y: standoff + thickness / 2,
      z: 0,
    });
    const map = this.own(this.painter.paint(width, depth, this.layout.art()));
    const top = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.1 }),
    );
    top.rotation.x = -Math.PI / 2;
    this.add(top, { x: 0, y: this.surface + CircuitBoard.TOP_OFFSET, z: 0 });
    this.buildStandoffs();
  }

  /**
   * Separadores de latón bajo los agujeros de montaje.
   */
  private buildStandoffs(): void {
    const { standoff } = this.layout.board;
    const brass = new MeshStandardMaterial({
      color: CircuitBoard.STANDOFF.color,
      roughness: 0.35,
      metalness: 0.85,
    });
    const { radius } = CircuitBoard.STANDOFF;
    this.layout.holes.forEach(({ x, z }) => {
      this.add(new Mesh(new CylinderGeometry(radius, radius, standoff, GeometryDetail.Low), brass), {
        x,
        y: standoff / 2,
        z,
      });
    });
  }

  /**
   * Componentes, pasivos y LEDs sobre la cara superior.
   */
  private buildParts(): void {
    const surface = this.surface;
    const place = (piece: ReturnType<ElectronicParts['build']>): void => {
      piece.position.y += surface;
      this.root.add(piece);
    };
    [...this.layout.parts(), ...this.layout.passives()].forEach((part) => {
      place(this.parts.build(part, this.leds[0] ?? new MeshBasicMaterial()));
    });
    this.layout.leds().forEach((part, index) => {
      place(this.parts.build(part, this.leds[index] ?? new MeshBasicMaterial()));
    });
  }

  /**
   * Motor junto a la placa, con sus cables hasta la bornera.
   */
  private buildMotor(): void {
    const { x, z } = CircuitBoard.MOTOR;
    this.motor.group.position.set(x, 0, z);
    this.root.add(this.motor.group);
    this.own(this.motor.dial);
    const terminal = this.layout.parts().find((part) => part.kind === 'terminal');
    if (!terminal) {
      return;
    }
    const exit = new Vector3().copy(this.motor.wireExit).add(this.motor.group.position);
    this.motor.wires.forEach(({ x: offset, color }, index) => {
      const lane = terminal.z + (index - 1 / 2) * (terminal.depth / 2);
      const end = new Vector3(terminal.x + terminal.width / 2, this.surface + CircuitBoard.WIRE.entry, lane);
      this.buildWire(exit.clone().setX(exit.x + offset), end, color);
    });
  }

  /**
   * Cable del motor: sale por detrás, baja a la barra y entra de lado a la bornera.
   *
   * @param start Salida en el motor.
   * @param end Entrada en la bornera.
   * @param color Color del aislante.
   */
  private buildWire(start: Vector3, end: Vector3, color: number): void {
    const { radius, drop, reach } = CircuitBoard.WIRE;
    const behind = start.clone().setZ(start.z - reach);
    const low = start
      .clone()
      .lerp(end, 1 / 2)
      .setY(drop);
    const approach = end.clone().setX(end.x + reach);
    const curve = new CatmullRomCurve3([start, behind, low, approach, end]);
    const insulation = new MeshStandardMaterial({ color, roughness: 0.5 });
    this.root.add(
      new Mesh(new TubeGeometry(curve, GeometryDetail.Ring, radius, GeometryDetail.Wire), insulation),
    );
  }

  /**
   * Sonda desde el conector CH1 del osciloscopio hasta TP1, con la tierra en TP2.
   */
  private buildProbe(): void {
    const from = this.root.worldToLocal(this.probeSource(new Vector3()));
    const [signal, ground] = this.layout.parts().filter((part) => part.kind === 'testpoint');
    if (!signal || !ground) {
      return;
    }
    const lift = this.surface + signal.depth;
    const probe = new ScopeProbe(
      from,
      new Vector3(signal.x, lift, signal.z),
      new Vector3(ground.x, lift, ground.z),
      this.surface,
    );
    this.root.add(probe.group);
  }
}
