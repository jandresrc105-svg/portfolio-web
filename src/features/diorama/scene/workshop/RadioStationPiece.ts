import {
  BoxGeometry,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { RadioSound } from '../../audio/RadioSound';
import type { Powerable } from '../../models/Powerable';
import { RadioControl } from '../../models/RadioControl';
import type { RadioHandle } from '../../models/RadioHandle';
import type { RadioState } from '../../models/RadioState';
import type { WorkshopContext } from '../../models/WorkshopContext';
import { RadioService } from '../../services/RadioService';
import { RadioAntenna } from './RadioAntenna';
import { RadioPanelArt } from './RadioPanelArt';
import { RadioReceiver } from './RadioReceiver';
import { RadioRfBoard } from './RadioRfBoard';
import { RadioWaterfall } from './RadioWaterfall';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Estación de radio del extremo izquierdo del banco: el receptor con su dial, el monitor del SDR encima
 * (espectro y cascada), la placa de RF expuesta delante y la antena telescópica a la derecha, unidos por
 * el coaxial y el cable de la placa. Cada frame avanza la simulación del receptor, mueve la aguja, el
 * rotor del capacitor y la antena, redibuja la pantalla (12 veces por segundo) y lleva el audio al
 * parlante.
 */
export class RadioStationPiece extends SceneObject implements Updatable, Powerable {
  private static readonly RECEIVER = { x: -0.95, z: -0.76 };
  private static readonly MONITOR = {
    x: -0.95,
    z: -0.79,
    width: 0.33,
    height: 0.215,
    depth: 0.04,
    tilt: -0.1,
    color: 0x15171a,
  };
  private static readonly SCREEN = { width: 0.3, height: 0.1875, lift: 0.001, glow: 1.25, off: 0.04 };
  private static readonly STAND = { width: 0.1, height: 0.02, depth: 0.08 };
  private static readonly BOARD = { x: -1.0, z: -0.5 };
  private static readonly ANTENNA = { x: -0.72, z: -0.56 };
  private static readonly CABLE = { radius: 0.0025, sag: 0.003, segments: 24 };
  private static readonly COAX = [
    { x: 0.04, z: 0.02 },
    { x: 0.11, z: -0.01 },
  ];
  private static readonly FEED = { x: -0.026 };
  private static readonly RIBBON = { rise: 0.02, forward: 0.02 };
  private static readonly REDRAW = 0.083;
  private static readonly BLINK = 2;
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.3 };

  private readonly art: RadioPanelArt;
  private readonly receiver: RadioReceiver;
  private readonly board: RadioRfBoard;
  private readonly antenna = new RadioAntenna();
  private readonly waterfall: RadioWaterfall;
  private readonly spectrum = new Float32Array(RadioWaterfall.BINS);
  private readonly housing = new MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.3,
    envMapIntensity: 0.4,
  });
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private readonly handles: RadioHandle[] = [];
  private level = 0;
  private clock = 0;
  private dirty = true;
  private lit = false;

  /**
   * Crea la estación.
   *
   * @param context Materiales, texturas y ubicación del taller.
   * @param service Receptor simulado.
   * @param sound Parlante.
   */
  public constructor(
    private readonly context: WorkshopContext,
    private readonly service: RadioService,
    private readonly sound: RadioSound,
  ) {
    super();
    this.art = new RadioPanelArt(context.textures);
    const band = { ...RadioService.BAND, stations: RadioService.STATIONS.map(({ frequency }) => frequency) };
    this.receiver = new RadioReceiver(this.art, context.materials, band);
    this.board = new RadioRfBoard(this.art);
    this.waterfall = new RadioWaterfall(context.textures, RadioService.BAND);
    this.housing.color.set(RadioStationPiece.MONITOR.color);
  }

  /**
   * Controles de toda la estación.
   *
   * @returns Controles con su material de resaltado.
   */
  public controls(): readonly RadioHandle[] {
    return [...this.receiver.controls, ...this.board.controls, ...this.antenna.controls, ...this.handles];
  }

  /**
   * Resalta el control señalado (y apaga los demás).
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.receiver.highlight(id);
    this.board.highlight(id);
    this.antenna.highlight(id);
    const { color, strength } = RadioStationPiece.HIGHLIGHT;
    this.housing.emissive.set(color).multiplyScalar(id === RadioControl.Screen ? strength : 0);
  }

  /**
   * Pide redibujar la pantalla en el próximo frame (cambió el estado).
   */
  public refresh(): void {
    this.dirty = true;
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
  public update(delta: number, elapsed: number): void {
    this.service.update(delta);
    const state = this.service.state;
    this.receiver.show(state, this.level, delta);
    this.board.show(state, this.level, delta);
    this.antenna.show(state, delta);
    this.sound.play(this.service.audio());
    this.redraw(state, delta, elapsed);
  }

  /**
   * @inheritdoc
   */
  protected build(): void {
    const deck = WorkshopLayout.BENCH.height;
    this.root.add(
      this.placed(this.receiver.group, RadioStationPiece.RECEIVER, deck + RadioReceiver.BODY.height / 2),
    );
    this.receiver.build().forEach((texture) => this.own(texture));
    this.root.add(this.placed(this.board.group, RadioStationPiece.BOARD, deck));
    this.own(this.board.build());
    this.root.add(this.placed(this.antenna.group, RadioStationPiece.ANTENNA, deck));
    this.antenna.build();
    this.buildMonitor(deck + RadioReceiver.BODY.height);
    this.buildCables();
    this.context.layout.place(this.root);
  }

  /**
   * Enciende la pantalla y la redibuja 12 veces por segundo (o al cambiar el estado).
   *
   * @param state Estado del receptor.
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio (parpadeo del cursor).
   */
  private redraw(state: RadioState, delta: number, elapsed: number): void {
    const { glow, off } = RadioStationPiece.SCREEN;
    this.screen.color.setScalar(state.on ? Math.max(this.level * glow, off) : off);
    this.clock += delta;
    if (!state.on) {
      this.darken();
      return;
    }
    if (this.dirty || this.clock >= RadioStationPiece.REDRAW) {
      this.clock = 0;
      this.dirty = false;
      this.lit = true;
      this.service.sample(this.spectrum);
      this.waterfall.draw(state, this.spectrum, Math.floor(elapsed * RadioStationPiece.BLINK) % 2 === 0);
    }
  }

  /**
   * Apaga la pantalla una sola vez al apagar el receptor.
   */
  private darken(): void {
    if (this.lit) {
      this.lit = false;
      this.waterfall.drawOff();
    }
  }

  /**
   * Monitor del SDR sobre el receptor: pie, carcasa inclinada y pantalla.
   *
   * @param base Altura de la tapa del receptor.
   */
  private buildMonitor(base: number): void {
    const { x, z, width, height, depth, tilt } = RadioStationPiece.MONITOR;
    const stand = RadioStationPiece.STAND;
    const foot = new Mesh(new BoxGeometry(stand.width, stand.height, stand.depth), this.housing);
    foot.position.set(x, base + stand.height / 2, z);
    const monitor = new Group();
    monitor.position.set(x, base + stand.height + height / 2, z);
    monitor.rotation.x = tilt;
    const screen = RadioStationPiece.SCREEN;
    this.screen.map = this.own(this.waterfall.create());
    const face = new Mesh(new PlaneGeometry(screen.width, screen.height), this.screen);
    face.position.z = depth / 2 + screen.lift;
    monitor.add(new Mesh(new BoxGeometry(width, height, depth), this.housing), face);
    this.root.add(foot, monitor);
    this.handles.push({ id: RadioControl.Screen, hitArea: face, glow: this.housing });
  }

  /**
   * Coaxial de la placa a la antena y cable de la placa al receptor, apoyados en la cubierta.
   */
  private buildCables(): void {
    const deck = WorkshopLayout.BENCH.height;
    const board = this.board.group.position;
    const start = this.board.antennaPort().add(board);
    const end = this.antenna.feedPoint().add(this.antenna.group.position);
    end.x += RadioStationPiece.FEED.x;
    const { sag } = RadioStationPiece.CABLE;
    const middle = RadioStationPiece.COAX.map(
      ({ x, z }) => new Vector3(start.x + x, deck + sag, start.z + z),
    );
    this.cable([start, ...middle, end]);
    const output = this.board.outputPort().add(board);
    const { rise, forward } = RadioStationPiece.RIBBON;
    const front = this.receiver.group.position.z + RadioReceiver.BODY.depth / 2;
    const inlet = new Vector3(output.x, deck + rise, front);
    this.cable([output, new Vector3(output.x, output.y, output.z - forward), inlet]);
  }

  /**
   * Agrega un cable que pasa por unos puntos.
   *
   * @param points Puntos del recorrido.
   */
  private cable(points: Vector3[]): void {
    const { radius, segments } = RadioStationPiece.CABLE;
    const geometry = new TubeGeometry(new CatmullRomCurve3(points), segments, radius, GeometryDetail.Wire);
    this.root.add(new Mesh(geometry, this.context.materials.cable));
  }

  /**
   * Ubica una sub-pieza en el taller.
   *
   * @param group Grupo de la sub-pieza.
   * @param at Posición en planta.
   * @param at.x Horizontal.
   * @param at.z Profundidad.
   * @param y Altura.
   * @returns El mismo grupo.
   */
  private placed(group: Group, at: { x: number; z: number }, y: number): Group {
    group.position.set(at.x, y, at.z);
    return group;
  }
}
