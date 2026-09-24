import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Material,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { CrossingSignalArt } from './CrossingSignalArt';
import { SignalCycle } from './SignalCycle';

/**
 * Semáforo de la esquina, a la japonesa: poste gris con un brazo sobre la calle de adelante, cabeza horizontal
 * para los carros (verde azulado, amarillo y rojo, con viseras) mirando al tráfico que llega, semáforo
 * peatonal con muñecos hacia el paso de cebra y la cajita amarilla del botón de cruce. Cambia solo según
 * {@link SignalCycle}; mientras los peatones tienen el siga avisa cada segundo, para el "piyo-piyo".
 */
export class TrafficSignal extends SceneObject implements Updatable, Powerable {
  private static readonly POSITION = { x: -4.72, y: 0.1, z: 1.82 };
  private static readonly FINISH = { color: 0x8a8d86, roughness: 0.5, metalness: 0.6 };
  private static readonly POLE = { radius: 0.055, height: 3.55 };
  private static readonly ARM = { radius: 0.035, length: 1.55, y: 3.35 };
  private static readonly HEAD = { width: 0.95, height: 0.32, depth: 0.2 };
  private static readonly CAR_LAMPS = [
    { z: 0.3, color: 0x14e0b4 },
    { z: 0, color: 0xffb21a },
    { z: -0.3, color: 0xff2a22 },
  ];
  private static readonly LAMP = { radius: 0.105, lift: 0.002 };
  private static readonly VISOR = { depth: 0.12, height: 0.018, width: 0.24, rise: 0.12 };
  private static readonly WALK_HEAD = { width: 0.3, height: 0.6, depth: 0.16, y: 2.35, z: 0.12 };
  private static readonly WALK_LAMPS = { size: 0.24, top: 0.14, color: { stop: 0xff3b30, go: 0x14e0b4 } };
  private static readonly BUTTON = { width: 0.14, height: 0.2, depth: 0.08, y: 1.15, color: 0xf2c81d };
  private static readonly GLOW = 2.6;
  private static readonly OFF_GLOW = 0.05;
  private static readonly CHIRP_EVERY = 1;

  private readonly cycle = new SignalCycle();
  private readonly carLamps = TrafficSignal.CAR_LAMPS.map(
    ({ color }) => new MeshBasicMaterial({ color, toneMapped: false }),
  );
  private readonly walkLamps = {
    stop: new MeshBasicMaterial({ toneMapped: false }),
    go: new MeshBasicMaterial({ toneMapped: false }),
  };
  private readonly art: CrossingSignalArt;
  private readonly chirpListeners: (() => void)[] = [];
  private readonly glows = new Map<MeshBasicMaterial, number>();
  private power = 0;
  private chirp = 0;

  /**
   * Crea el semáforo.
   *
   * @param textures Fábrica de texturas (para los muñecos del semáforo peatonal).
   */
  public constructor(textures: CanvasTextureFactory) {
    super();
    this.art = new CrossingSignalArt(textures);
  }

  /**
   * Registra quién suena el aviso de cruce.
   *
   * @param listener Se llama una vez por cada "piyo-piyo".
   */
  public onChirp(listener: () => void): void {
    this.chirpListeners.push(listener);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.power = level;
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.cycle.update(delta);
    this.carLamps.forEach((material, index) => {
      this.light(material, TrafficSignal.CAR_LAMPS[index]?.color ?? 0, this.cycle.car === index);
    });
    const { stop, go } = TrafficSignal.WALK_LAMPS.color;
    this.light(this.walkLamps.stop, stop, this.cycle.stopLit());
    this.light(this.walkLamps.go, go, this.cycle.walkLit(elapsed));
    this.tickChirp(delta);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const paint = new MeshStandardMaterial(TrafficSignal.FINISH);
    this.buildPole(paint);
    this.buildCarHead(paint);
    this.buildWalkHead(paint);
    this.root.position.copy(TrafficSignal.POSITION);
  }

  /**
   * Poste, brazo sobre la calle y cajita del botón de cruce.
   *
   * @param paint Pintura gris del poste.
   */
  private buildPole(paint: Material): void {
    const { radius, height } = TrafficSignal.POLE;
    this.add(new Mesh(new CylinderGeometry(radius, radius, height, GeometryDetail.Low), paint), {
      x: 0,
      y: height / 2,
      z: 0,
    });
    const arm = TrafficSignal.ARM;
    const beam = this.add(
      new Mesh(new CylinderGeometry(arm.radius, arm.radius, arm.length, GeometryDetail.Low), paint),
      { x: 0, y: arm.y, z: arm.length / 2 },
    );
    beam.rotation.x = Math.PI / 2;
    const button = TrafficSignal.BUTTON;
    const plastic = new MeshStandardMaterial({
      color: button.color,
      roughness: TrafficSignal.FINISH.roughness,
    });
    this.box(button, { x: 0, y: button.y, z: radius + button.depth / 2 }, plastic);
  }

  /**
   * Cabeza horizontal para los carros en la punta del brazo, mirando a +x, con una visera sobre cada luz.
   *
   * @param paint Pintura de la carcasa.
   */
  private buildCarHead(paint: Material): void {
    const { width, height, depth } = TrafficSignal.HEAD;
    const { y, length } = TrafficSignal.ARM;
    this.box({ width: depth, height, depth: width }, { x: 0, y, z: length }, paint);
    const face = depth / 2;
    const visor = TrafficSignal.VISOR;
    TrafficSignal.CAR_LAMPS.forEach(({ z }, index) => {
      const lamp = new CircleGeometry(TrafficSignal.LAMP.radius, GeometryDetail.Medium);
      const disc = this.add(new Mesh(lamp, this.carLamps[index]), {
        x: face + TrafficSignal.LAMP.lift,
        y,
        z: length + z,
      });
      disc.rotation.y = Math.PI / 2;
      const shade = { width: visor.depth, height: visor.height, depth: visor.width };
      this.box(shade, { x: face + visor.depth / 2, y: y + visor.rise, z: length + z }, paint);
    });
  }

  /**
   * Semáforo peatonal en el poste, mirando al paso de cebra: pare arriba, siga abajo.
   *
   * @param paint Pintura de la carcasa.
   */
  private buildWalkHead(paint: Material): void {
    const head = TrafficSignal.WALK_HEAD;
    this.box(head, { x: 0, y: head.y, z: head.z }, paint);
    const { size, top } = TrafficSignal.WALK_LAMPS;
    this.walkLamps.stop.map = this.own(this.art.standing());
    this.walkLamps.go.map = this.own(this.art.walking());
    const front = head.z + head.depth / 2 + TrafficSignal.LAMP.lift;
    this.add(new Mesh(new PlaneGeometry(size, size), this.walkLamps.stop), {
      x: 0,
      y: head.y + top,
      z: front,
    });
    this.add(new Mesh(new PlaneGeometry(size, size), this.walkLamps.go), { x: 0, y: head.y - top, z: front });
  }

  /**
   * Enciende o apaga una luz según la energía del semáforo.
   *
   * @param material Material de la luz.
   * @param color Color de la luz.
   * @param lit Si le toca estar encendida.
   */
  private light(material: MeshBasicMaterial, color: number, lit: boolean): void {
    const glow = Math.max(lit ? TrafficSignal.GLOW * this.power : 0, TrafficSignal.OFF_GLOW);
    if (this.glows.get(material) === glow) {
      return;
    }
    this.glows.set(material, glow);
    material.color.set(color).multiplyScalar(glow);
  }

  /**
   * Cuenta el tiempo del siga peatonal y avisa cada segundo.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private tickChirp(delta: number): void {
    if (!this.cycle.crossing || this.power <= 0) {
      this.chirp = 0;
      return;
    }
    this.chirp -= delta;
    if (this.chirp <= 0) {
      this.chirp = TrafficSignal.CHIRP_EVERY;
      this.chirpListeners.forEach((listener) => {
        listener();
      });
    }
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param size.width Ancho (x).
   * @param size.height Alto (y).
   * @param size.depth Profundidad (z).
   * @param position Posición del centro.
   * @param material Material.
   */
  private box(
    size: { width: number; height: number; depth: number },
    position: Vector3Like,
    material: Material,
  ): void {
    this.add(new Mesh(new BoxGeometry(size.width, size.height, size.depth), material), position);
  }
}
