import {
  BoxGeometry,
  Euler,
  type Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Material,
  type Vector3Like,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { OhmLabState } from '../../models/OhmLabState';
import type { Powerable } from '../../models/Powerable';
import type { ResistorCode } from '../../models/ResistorCode';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import { OhmLabService } from '../../services/OhmLabService';
import { BenchCable } from './BenchCable';
import { GiantResistor } from './GiantResistor';
import { LedLamp } from './LedLamp';
import { OhmDisplays } from './OhmDisplays';
import { OhmMeter } from './OhmMeter';
import { BatteryPack } from './ohm/BatteryPack';
import { DecadeBox } from './ohm/DecadeBox';
import { OhmLabArt } from './ohm/OhmLabArt';
import { SpareDrawer } from './ohm/SpareDrawer';
import type { WorkshopLayout } from './WorkshopLayout';

/**
 * "Ley de Ohm en vivo" en el extremo derecho del banco (patrón Composite): década de resistencias, batería de
 * 9 V con su interruptor, protoboard con un LED rojo grande en serie, panel de medición con V, R, I y P, el
 * cajoncito de LEDs de repuesto y una resistencia gigante de muestra con el código de colores del valor
 * elegido. Los cables unen batería → interruptor → década → LED → batería. Se construye en el espacio local
 * del taller.
 */
export class OhmLabPiece extends SceneObject implements Updatable, Powerable {
  private static readonly BENCH_TOP = 0.9;
  private static readonly DECADE = { x: 0.83, z: -0.83, tilt: 0.3, foot: 0.02, color: 0x16181b };
  private static readonly METER = { x: 1.09, z: -0.85 };
  private static readonly BOARD = {
    x: 0.845,
    z: -0.58,
    width: 0.17,
    height: 0.012,
    depth: 0.1,
    color: 0xf2eee4,
  };
  private static readonly LED = { x: 0.83, z: -0.585, leg: 0.0035 };
  private static readonly PADS = { anode: { x: 0.86, z: -0.605 }, cathode: { x: 0.8, z: -0.57 } };
  private static readonly BATTERY = { x: 0.72, z: -0.57 };
  private static readonly DRAWER = { x: 0.86, z: -0.43 };
  private static readonly RESISTOR = { x: 1.065, z: -0.56 };
  private static readonly ROUTE = {
    plus: { x: 0.698, y: 0.935, z: -0.54 },
    around: [
      { x: 0.745, y: 0.904, z: -0.645 },
      { x: 0.93, y: 0.904, z: -0.7 },
    ],
    minus: { x: 0.765, y: 0.924, z: -0.57 },
    feed: { x: 0.875, y: 0.905, z: -0.665 },
  };
  private static readonly WIRE = { radius: 0.0022, trace: 0.0009, lift: 0.001 };
  private static readonly WIRES = { red: 0xd4282a, black: 0x1b1b1d, yellow: 0xf2c81d, copper: 0xc9ccd0 };

  private readonly art: OhmLabArt;
  private readonly displays: OhmDisplays;
  private readonly decade: DecadeBox;
  private readonly meter: OhmMeter;
  private readonly lamp: LedLamp;
  private readonly battery: BatteryPack;
  private readonly drawer: SpareDrawer;
  private readonly resistor: GiantResistor;
  private readonly cables = new BenchCable();
  private readonly layout: WorkshopLayout;
  private state: OhmLabState | null = null;
  private code: { code: ResistorCode; label: string } | null = null;
  private level = 0;

  /**
   * Crea la pieza.
   *
   * @param context Materiales, texturas, ubicación, audio y azar del taller.
   * @param clock Reloj del circuito, que avanza en cada frame antes de dibujar.
   */
  public constructor(
    context: WorkshopContext,
    private readonly clock: Updatable,
  ) {
    super();
    this.layout = context.layout;
    this.art = this.own(new OhmLabArt(context.textures));
    this.displays = new OhmDisplays(context.textures);
    this.decade = new DecadeBox(this.art, this.displays);
    this.meter = new OhmMeter(this.displays);
    this.lamp = new LedLamp(context.random);
    this.battery = new BatteryPack(this.art);
    this.drawer = new SpareDrawer(this.art);
    this.resistor = new GiantResistor(this.displays);
  }

  /**
   * Controles que reciben el puntero.
   *
   * @returns Perillas, interruptor, LED, cajón, resistencia y panel.
   */
  public controls(): WorkshopControl[] {
    const knobs = this.decade.hitAreas.map((hitArea, index) => ({
      id: OhmLabService.knobId(index),
      hitArea,
    }));
    return [
      ...knobs,
      { id: OhmLabService.SWITCH, hitArea: this.battery.hitArea },
      { id: OhmLabService.LED, hitArea: this.lamp.hitArea },
      { id: OhmLabService.SPARES, hitArea: this.drawer.hitArea },
      { id: OhmLabService.RESISTOR, hitArea: this.resistor.hitArea },
      { id: OhmLabService.METER, hitArea: this.meter.hitArea },
    ];
  }

  /**
   * Muestra el estado del circuito y el código de colores de la resistencia.
   *
   * @param state Estado del circuito.
   * @param code Código de colores.
   * @param label Valor normalizado para la placa.
   */
  public show(state: OhmLabState, code: ResistorCode, label: string): void {
    this.state = state;
    this.code = { code, label };
    this.apply();
  }

  /**
   * Quema el LED: destello y humo.
   */
  public burst(): void {
    this.lamp.burst();
  }

  /**
   * Saca un LED nuevo del cajón.
   */
  public renew(): void {
    this.drawer.nudge();
  }

  /**
   * Resalta el control señalado (y apaga el resto).
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    const knob = this.decade.hitAreas.findIndex((_, index) => OhmLabService.knobId(index) === id);
    this.decade.highlight(knob);
    this.battery.highlight(id === OhmLabService.SWITCH);
    this.lamp.highlight(id === OhmLabService.LED);
    this.drawer.highlight(id === OhmLabService.SPARES);
    this.resistor.highlight(id === OhmLabService.RESISTOR);
    this.meter.highlight(id === OhmLabService.METER);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.apply();
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.clock.update(delta, elapsed);
    this.decade.update(delta);
    this.battery.update(delta);
    this.lamp.update(delta, elapsed);
    this.drawer.update(delta);
    this.resistor.update(delta);
    if (this.state) {
      this.meter.show(this.state, this.level, elapsed);
    }
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    this.decade.dispose();
    this.meter.dispose();
    this.resistor.dispose();
    super.dispose();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildDecade();
    this.put(this.meter.build(), OhmLabPiece.METER);
    this.buildBoard();
    this.put(this.battery.build(), OhmLabPiece.BATTERY);
    this.put(this.drawer.build(), OhmLabPiece.DRAWER);
    this.put(this.resistor.build(), OhmLabPiece.RESISTOR);
    this.buildWires();
    this.layout.place(this.root);
  }

  /**
   * Lleva el estado guardado a cada parte.
   */
  private apply(): void {
    const { state, code, level } = this;
    if (!state || !code) {
      return;
    }
    this.decade.show(state.digits, state.ohms, level);
    this.battery.apply(state.closed, level);
    this.lamp.apply(state, level);
    const heat = Math.min(Math.max((state.watts - state.rating) / state.rating, 0), 1);
    this.resistor.show(code.code, code.label, heat, level);
  }

  /**
   * Década inclinada hacia quien mira, apoyada en un pie bajo su borde trasero.
   */
  private buildDecade(): void {
    const { x, z, tilt, foot, color } = OhmLabPiece.DECADE;
    const { width, height, depth } = DecadeBox.BODY;
    const group = this.decade.build(OhmLabService.WEIGHTS.map(({ label }) => label));
    const center = height / 2 + (height / 2) * Math.cos(tilt) + (depth / 2) * Math.sin(tilt);
    group.rotation.x = tilt;
    group.position.set(x, OhmLabPiece.BENCH_TOP + center - height / 2, z);
    group.updateMatrix();
    this.add(group);
    const back = new Vector3(0, -height / 2, -depth / 2).applyEuler(new Euler(tilt)).add(group.position);
    const rise = back.y - OhmLabPiece.BENCH_TOP;
    const stand = new Mesh(new BoxGeometry(width - foot, rise, foot), new MeshStandardMaterial({ color }));
    this.add(stand, { x, y: OhmLabPiece.BENCH_TOP + rise / 2, z: back.z + foot / 2 });
  }

  /**
   * Protoboard con su serigrafía de agujeros, el LED y las pistas hasta sus patas.
   */
  private buildBoard(): void {
    const { x, z, width, height, depth, color } = OhmLabPiece.BOARD;
    const top = OhmLabPiece.BENCH_TOP + height;
    this.add(
      new Mesh(new BoxGeometry(width, height, depth), new MeshStandardMaterial({ color, roughness: 0.8 })),
      { x, y: OhmLabPiece.BENCH_TOP + height / 2, z },
    );
    const face = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshStandardMaterial({ map: this.art.breadboard(), roughness: 0.8, envMapIntensity: 0.2 }),
    );
    face.rotation.x = -Math.PI / 2;
    this.add(face, { x, y: top + OhmLabPiece.WIRE.lift, z });
    const led = OhmLabPiece.LED;
    this.add(this.lamp.build(), { x: led.x, y: top, z: led.z });
    this.buildTraces(top + OhmLabPiece.WIRE.lift);
  }

  /**
   * Pistas cortas de los cables del circuito a las patas del LED.
   *
   * @param y Altura de la cara de la protoboard.
   */
  private buildTraces(y: number): void {
    const { LED, PADS, WIRE, WIRES } = OhmLabPiece;
    const copper = new MeshStandardMaterial({ color: WIRES.copper, roughness: 0.3, metalness: 0.9 });
    this.add(this.cables.rod({ ...PADS.anode, y }, { x: LED.x + LED.leg, y, z: LED.z }, WIRE.trace, copper));
    this.add(
      this.cables.rod({ ...PADS.cathode, y }, { x: LED.x - LED.leg, y, z: LED.z }, WIRE.trace, copper),
    );
  }

  /**
   * Cables del circuito en serie: batería + → interruptor → década → LED → batería −.
   */
  private buildWires(): void {
    const { ROUTE, PADS, WIRES } = OhmLabPiece;
    const pads = OhmLabPiece.BENCH_TOP + OhmLabPiece.BOARD.height;
    const battery = (index: number): Vector3 => this.battery.terminal(index).add(this.battery.group.position);
    const decade = (index: number): Vector3 =>
      this.decade.terminal(index).applyMatrix4(this.decade.group.matrix);
    this.wire([battery(0), ROUTE.plus, battery(2)], WIRES.red);
    this.wire([battery(3), ...ROUTE.around, decade(0)], WIRES.red);
    this.wire([decade(1), ROUTE.feed, { ...PADS.anode, y: pads }], WIRES.yellow);
    this.wire([{ ...PADS.cathode, y: pads }, ROUTE.minus, battery(1)], WIRES.black);
  }

  /**
   * Agrega un cable que pasa por los puntos dados.
   *
   * @param points Puntos de paso.
   * @param color Color del forro.
   */
  private wire(points: readonly Vector3Like[], color: number): void {
    const material: Material = new MeshStandardMaterial({ color, roughness: 0.55 });
    this.add(this.cables.curve(points, OhmLabPiece.WIRE.radius, material));
  }

  /**
   * Coloca una parte sobre la cubierta del banco.
   *
   * @param group Grupo de la parte (origen en su base).
   * @param at Posición en el banco.
   * @param at.x Horizontal.
   * @param at.z Profundidad.
   */
  private put(group: Group, at: { x: number; z: number }): void {
    this.add(group, { x: at.x, y: OhmLabPiece.BENCH_TOP, z: at.z });
  }
}
