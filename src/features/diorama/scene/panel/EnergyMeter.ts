import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { BreakerPanelArt } from './BreakerPanelArt';

/**
 * Medidor de energía analógico bajo el tablero: base metálica, carátula con el contador de rodillos (los años
 * de experiencia), disco de aluminio con su marca negra y una tapa de vidrio. El disco gira más rápido
 * cuantas más etapas reciben corriente. Se construye en un grupo con origen en el centro de la base.
 */
export class EnergyMeter {
  private static readonly BASE = { width: 0.2, height: 0.26, depth: 0.06, color: 0x6c7479 };
  private static readonly FACE = { radius: 0.08, lift: 0.001, glow: 0.8 };
  private static readonly DISC = { radius: 0.05, thickness: 0.004, y: -0.05, z: 0.022, color: 0xc9ced2 };
  private static readonly MARK = { width: 0.012, height: 0.005, depth: 0.004 };
  private static readonly COVER = { radius: 0.088, depth: 0.05, color: 0xdff4ff, opacity: 0.08 };
  private static readonly SPIN = { idle: 0.6, full: 7, closed: 4 };
  private static readonly TENTHS = 10;
  private static readonly SELF_LIGHT = 0.2;
  private static readonly OFF_GLOW = 0.15;

  public readonly group = new Group();

  private readonly face = new MeshBasicMaterial({ toneMapped: false });
  private readonly disc = new Group();
  private speed = 0;
  private reading = -1;

  /**
   * Crea el medidor.
   *
   * @param art Gráficas del tablero (carátula).
   */
  public constructor(private readonly art: BreakerPanelArt) {}

  /**
   * Construye la base, la carátula, el disco y la tapa.
   *
   * @returns Grupo del medidor.
   */
  public build(): Group {
    const { width, height, depth, color } = EnergyMeter.BASE;
    const base = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
    base.emissive.set(color).multiplyScalar(EnergyMeter.SELF_LIGHT);
    this.group.add(new Mesh(new BoxGeometry(width, height, depth), base));
    const face = new Mesh(new CircleGeometry(EnergyMeter.FACE.radius, GeometryDetail.Ring), this.face);
    face.position.z = depth / 2 + EnergyMeter.FACE.lift;
    this.group.add(face);
    this.buildDisc(depth / 2);
    this.buildCover(depth / 2);
    return this.group;
  }

  /**
   * Muestra los años de experiencia en el contador (redibuja solo si cambió la décima).
   *
   * @param years Años.
   * @param replace Cambia la textura anterior por la nueva y devuelve la que queda en uso.
   */
  public setReading(years: number, replace: (previous: Texture | null, next: Texture) => Texture): void {
    const tenths = Math.round(years * EnergyMeter.TENTHS);
    if (tenths === this.reading) {
      return;
    }
    this.reading = tenths;
    this.face.map = replace(this.face.map, this.art.meter(years));
    this.face.needsUpdate = true;
  }

  /**
   * Fija el brillo de la carátula y la velocidad del disco.
   *
   * @param level Brillo general (encendido de la escena).
   * @param load Fracción de etapas con corriente [0, 1], o -1 sin energía.
   * @param closed Si el circuito está cerrado.
   */
  public setLoad(level: number, load: number, closed: boolean): void {
    const { idle, full, closed: bonus } = EnergyMeter.SPIN;
    this.face.color.setScalar(Math.max(level * EnergyMeter.FACE.glow, EnergyMeter.OFF_GLOW));
    this.speed = load < 0 ? 0 : level * (idle + load * full + (closed ? bonus : 0));
  }

  /**
   * Gira el disco.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    this.disc.rotation.y += this.speed * delta;
  }

  /**
   * Disco de aluminio horizontal con su marca negra, delante de la parte baja de la carátula.
   *
   * @param front Coordenada z de la cara frontal de la base.
   */
  private buildDisc(front: number): void {
    const { radius, thickness, y, z, color } = EnergyMeter.DISC;
    const material = new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.8 });
    material.emissive.set(color).multiplyScalar(EnergyMeter.SELF_LIGHT);
    this.disc.add(new Mesh(new CylinderGeometry(radius, radius, thickness, GeometryDetail.Ring), material));
    const { width, height, depth } = EnergyMeter.MARK;
    const mark = new Mesh(new BoxGeometry(width, height, depth), new MeshBasicMaterial({ color: 0x000000 }));
    mark.position.set(0, 0, radius);
    this.disc.add(mark);
    this.disc.position.set(0, y, front + z);
    this.group.add(this.disc);
  }

  /**
   * Tapa de vidrio casi invisible sobre la carátula.
   *
   * @param front Coordenada z de la cara frontal de la base.
   */
  private buildCover(front: number): void {
    const { radius, depth, color, opacity } = EnergyMeter.COVER;
    const glass = new MeshBasicMaterial({
      color,
      opacity,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const cover = new Mesh(new CylinderGeometry(radius, radius, depth, GeometryDetail.Ring, 1, true), glass);
    cover.rotation.x = Math.PI / 2;
    cover.position.z = front + depth / 2;
    this.group.add(cover);
  }
}
