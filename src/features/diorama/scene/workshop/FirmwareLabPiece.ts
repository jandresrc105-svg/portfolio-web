import { CatmullRomCurve3, Mesh, TubeGeometry, type Object3D, type Vector3 } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { FirmwarePhase } from '../../models/FirmwarePhase';
import type { FirmwareState } from '../../models/FirmwareState';
import type { Powerable } from '../../models/Powerable';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import { FirmwareService } from '../../services/FirmwareService';
import { LaptopScreen } from './LaptopScreen';
import { FirmwareControl } from './firmware/FirmwareControl';
import { FirmwareDesk } from './firmware/FirmwareDesk';
import { FirmwareKit } from './firmware/FirmwareKit';
import { FirmwareLabArt } from './firmware/FirmwareLabArt';
import { FirmwareLaptop } from './firmware/FirmwareLaptop';

/**
 * Laboratorio de firmware en vivo, contra la pared izquierda del taller: mesa lateral con una laptop que
 * muestra el IDE (lista de programas, código, consola y monitor serie) y, cableada por USB, una ESP32 en una
 * protoboard con una matriz de LEDs 8×8, un buzzer, un potenciómetro y un servo. Cada frame avanza el
 * programa que corre en la placa ({@link FirmwareService}) y muestra su estado; la pantalla se redibuja
 * pocas veces por segundo y solo si cambió.
 */
export class FirmwareLabPiece extends SceneObject implements Updatable, Powerable {
  private static readonly LAPTOP = { x: -0.98, z: 0, turn: 0.75 };
  private static readonly KIT = { x: -0.96, z: 0.52, turn: 0.5 };
  private static readonly MAT = 0.002;
  private static readonly CABLE = { radius: 0.0022, reach: 0.035, lift: 0.003 };
  private static readonly REDRAW = { active: 0.1, idle: 0.25 };
  private static readonly TX = { hold: 0.06, blink: 18 };

  private readonly desk: FirmwareDesk;
  private readonly laptop = new FirmwareLaptop();
  private readonly kit: FirmwareKit;
  private readonly screen: LaptopScreen;
  private readonly art: FirmwareLabArt;
  private level = 0;
  private active = false;
  private hover: string | null = null;
  private redraw = 0;
  private readonly traffic = { count: -1, hold: 0 };

  /**
   * Crea la pieza.
   *
   * @param context Materiales, texturas y ubicación del taller.
   * @param service Estado del laboratorio.
   */
  public constructor(
    private readonly context: WorkshopContext,
    private readonly service: FirmwareService,
  ) {
    super();
    this.desk = new FirmwareDesk(context.materials);
    this.kit = new FirmwareKit(context.materials.metal);
    this.screen = new LaptopScreen(context.textures);
    this.art = new FirmwareLabArt(context.textures);
  }

  /**
   * Controles de la laptop y de la protoboard.
   *
   * @returns Controles.
   */
  public controls(): WorkshopControl[] {
    return [...this.laptop.controls(), ...this.kit.controls()];
  }

  /**
   * LEDs encendidos y ángulo real del servo (para los tooltips).
   *
   * @returns Lecturas.
   */
  public readings(): { lit: number; servo: number } {
    return this.kit.readings();
  }

  /**
   * Resalta el control señalado (en la pantalla o en la protoboard).
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.hover = id;
    this.kit.highlight(id);
    this.redraw = 0;
  }

  /**
   * Avisa si el taller está en pantalla (la pantalla se redibuja más seguido).
   *
   * @param active Si está en pantalla.
   */
  public setActive(active: boolean): void {
    this.active = active;
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.laptop.setGlow(level);
    this.desk.setGlow(level);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.service.advance(delta);
    const state = this.service.state;
    const lights = { tx: this.transmitting(state, delta, elapsed), rx: false, io2: state.builtin };
    lights.rx = state.phase === FirmwarePhase.Flashing && !lights.tx;
    const view = {
      matrix: state.matrix,
      servo: state.servo,
      buzzing: state.buzzer > 0,
      pot: state.pot / FirmwareService.ADC_MAX,
      lights,
    };
    this.kit.show(view, { delta, level: this.level });
    this.redraw -= delta;
    if (this.redraw <= 0) {
      const { active, idle } = FirmwareLabPiece.REDRAW;
      this.redraw = this.active ? active : idle;
      this.screen.draw(state, this.hover, elapsed);
    }
  }

  /**
   * @inheritdoc
   */
  protected build(): void {
    this.add(this.desk.build(this.own(this.art.sign())));
    const laptop = this.laptop.build(
      { screen: this.own(this.screen.create()), keyboard: this.own(this.art.keyboard()) },
      { canvas: LaptopScreen.CANVAS, areas: this.screenAreas() },
    );
    this.put(laptop, FirmwareLabPiece.LAPTOP);
    const kit = this.kit.build({ silk: this.own(this.art.board()), holes: this.own(this.art.breadboard()) });
    this.put(kit, FirmwareLabPiece.KIT);
    this.root.updateMatrixWorld(true);
    this.buildCable(laptop.localToWorld(this.laptop.usbPort()), kit.localToWorld(this.kit.usbPort()));
    this.context.layout.place(this.root);
  }

  /**
   * Zonas de la pantalla que responden: una por programa y el botón "Subir".
   *
   * @returns Id y rectángulo de cada zona.
   */
  private screenAreas(): { id: string; rect: { x: number; y: number; width: number; height: number } }[] {
    const programs = this.service.state.programs.map((_, index) => ({
      id: LaptopScreen.programId(index),
      rect: LaptopScreen.program(index),
    }));
    return [...programs, { id: FirmwareControl.Upload, rect: LaptopScreen.UPLOAD }];
  }

  /**
   * Apoya una pieza sobre la alfombra de la mesa, girada hacia el frente del taller.
   *
   * @param object Pieza.
   * @param at Posición y giro.
   * @param at.x Horizontal.
   * @param at.z Profundidad.
   * @param at.turn Giro en Y.
   */
  private put(object: Object3D, at: { x: number; z: number; turn: number }): void {
    object.position.set(at.x, FirmwareDesk.TOP + FirmwareLabPiece.MAT, at.z);
    object.rotation.y = at.turn;
    this.add(object);
  }

  /**
   * Cable USB de la laptop a la placa, apoyado en la mesa.
   *
   * @param from Puerto de la laptop (espacio de la pieza).
   * @param to Puerto de la placa (espacio de la pieza).
   */
  private buildCable(from: Vector3, to: Vector3): void {
    const { radius, reach, lift } = FirmwareLabPiece.CABLE;
    const floor = FirmwareDesk.TOP + FirmwareLabPiece.MAT + lift;
    const middle = from.clone().lerp(to, 0.5).setY(floor);
    const leave = from
      .clone()
      .lerp(middle, reach / Math.max(from.distanceTo(middle), reach))
      .setY(floor);
    const arrive = to
      .clone()
      .lerp(middle, reach / Math.max(to.distanceTo(middle), reach))
      .setY(floor);
    const curve = new CatmullRomCurve3([from, leave, middle, arrive, to]);
    const cable = new Mesh(
      new TubeGeometry(curve, GeometryDetail.Curve, radius, GeometryDetail.Wire),
      this.context.materials.cable,
    );
    this.add(cable);
  }

  /**
   * Si el LED TX está prendido: parpadea mientras se escribe la flash y se queda un instante encendido
   * cada vez que el programa escribe por el puerto serie.
   *
   * @param state Estado del laboratorio.
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde que empezó la escena.
   * @returns `true` si está encendido.
   */
  private transmitting(state: FirmwareState, delta: number, elapsed: number): boolean {
    const { hold, blink } = FirmwareLabPiece.TX;
    if (state.phase === FirmwarePhase.Flashing) {
      return Math.floor(elapsed * blink) % 2 === 0;
    }
    this.traffic.hold = state.traffic === this.traffic.count ? this.traffic.hold - delta : hold;
    this.traffic.count = state.traffic;
    return this.traffic.hold > 0;
  }
}
