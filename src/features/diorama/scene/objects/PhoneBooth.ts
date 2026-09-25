import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  type Material,
  type Object3D,
  type Vector3Like,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { PhoneDisplay } from '../../models/PhoneDisplay';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { PayPhone } from './PayPhone';
import { PhoneBoothArt } from './PhoneBoothArt';

/**
 * Cabina telefónica japonesa, el punto de contacto: base de concreto, marco verde oscuro, zócalo opaco,
 * paredes de vidrio, franja luminosa "公衆電話" bajo el techo y un tubo fluorescente frío que ilumina el
 * teléfono verde de la pared del fondo (con su repisa y guía telefónica). El tubo parpadea de vez en cuando;
 * el teléfono se usa de verdad (ver {@link PayPhone}): la cabina solo lo aloja y le pasa las órdenes.
 */
export class PhoneBooth extends SceneObject implements Updatable, Powerable {
  private static readonly POSITION = { x: -4.2, y: 0.1, z: 0.9 };
  private static readonly ROTATION_Y = 0.4;
  private static readonly FINISH = {
    frame: { color: 0x1d4a36, roughness: 0.4, metalness: 0.6 },
    book: { color: 0xe8c547, roughness: 0.7 },
  };
  private static readonly SIZE = { width: 0.86, depth: 0.86, height: 1.95 };
  private static readonly BASE = { width: 0.94, height: 0.06, depth: 0.94 };
  private static readonly POST = 0.05;
  private static readonly PANEL = { height: 0.34, thickness: 0.02 };
  private static readonly GLASS = { color: 0xc8f2e0, opacity: 0.02 };
  private static readonly SIDES = [
    { x: 0, z: 1, quarter: false },
    { x: 0, z: -1, quarter: false },
    { x: 1, z: 0, quarter: true },
    { x: -1, z: 0, quarter: true },
  ];
  private static readonly HANDLE = { width: 0.02, height: 0.4, depth: 0.03, x: 0.3, y: 1.05 };
  private static readonly SIGN = { height: 0.15, glow: 0.75 };
  private static readonly ROOF = { width: 1.02, height: 0.07, depth: 1.02 };
  private static readonly TUBE = { radius: 0.016, length: 0.6, y: 1.9, color: 0xe6fff2, glow: 3 };
  private static readonly LIGHT = { color: 0xeafff6, intensity: 1.2, distance: 3.2, y: 1.7, z: 0.2 };
  private static readonly FLICKER = { fast: 23, slow: 1.3, threshold: 0.93, dim: 0.35 };
  private static readonly PHONE = { y: 1.28, inset: 0.1 };
  private static readonly SHELF = { width: 0.5, height: 0.03, depth: 0.24, y: 0.92 };
  private static readonly BOOK = { width: 0.2, height: 0.05, depth: 0.15, x: 0.12 };
  private static readonly OFF_GLOW = 0.04;

  private readonly art: PhoneBoothArt;
  private readonly phone: PayPhone;
  private handset: Object3D | null = null;
  private readonly sign = new MeshBasicMaterial({ toneMapped: false });
  private readonly tube = new MeshBasicMaterial({ color: PhoneBooth.TUBE.color });
  private readonly light = new PointLight(PhoneBooth.LIGHT.color, 0, PhoneBooth.LIGHT.distance, 2);
  private readonly frame = new MeshStandardMaterial(PhoneBooth.FINISH.frame);
  private readonly glass = new MeshBasicMaterial({
    ...PhoneBooth.GLASS,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  private level = 0;

  /**
   * Crea la cabina.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   * @param keys Texto de cada tecla del teléfono, en orden de lectura.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    textures: CanvasTextureFactory,
    keys: readonly string[],
  ) {
    super();
    this.art = new PhoneBoothArt(textures);
    this.phone = new PayPhone(this.art, keys);
  }

  /**
   * Zonas del teléfono que reciben el puntero: el auricular, la pantalla y cada tecla.
   *
   * @param hook Id del auricular.
   * @param screen Id de la pantalla.
   * @returns Pares control-malla.
   */
  public controls(hook: string, screen: string): { id: string; hitArea: Object3D }[] {
    return this.phone.controls(hook, screen);
  }

  /**
   * Descuelga o cuelga el auricular.
   *
   * @param lifted `true` para descolgar.
   */
  public setLifted(lifted: boolean): void {
    this.phone.setLifted(lifted);
  }

  /**
   * Redibuja la pantalla del teléfono.
   *
   * @param display Líneas de la pantalla.
   */
  public setDisplay(display: PhoneDisplay): void {
    this.phone.setDisplay(display);
  }

  /**
   * Redibuja la tarjeta de marcado rápido.
   *
   * @param labels Nombre de cada canal, en el orden de las teclas.
   */
  public setDirectory(labels: readonly string[]): void {
    this.phone.setDirectory(labels);
  }

  /**
   * Resalta el control señalado del teléfono.
   *
   * @param id Control o `null`.
   * @param hook Id del auricular.
   */
  public highlight(id: string | null, hook: string): void {
    this.phone.highlight(id, hook);
  }

  /**
   * Hunde una tecla del teléfono.
   *
   * @param id Tecla.
   */
  public pressKey(id: string): void {
    this.phone.pressKey(id);
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    super.dispose();
    this.phone.dispose();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.sign.color.setScalar(Math.max(level * PhoneBooth.SIGN.glow, PhoneBooth.OFF_GLOW));
    this.phone.setPower(level);
    this.applyTube(1);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    const { fast, slow, threshold, dim } = PhoneBooth.FLICKER;
    const noise = Math.sin(elapsed * fast) * Math.sin(elapsed * slow);
    this.applyTube(noise > threshold ? dim : 1);
    this.phone.update(delta, elapsed);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { width, height, depth } = PhoneBooth.BASE;
    this.box({ x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, this.materials.concrete);
    this.buildFrame();
    this.buildWalls();
    this.buildTop();
    this.buildInterior();
    this.root.position.copy(PhoneBooth.POSITION);
    this.root.rotation.y = PhoneBooth.ROTATION_Y;
    this.settle(...(this.handset ? [this.handset] : []));
    this.setPower(0);
  }

  /**
   * Cuatro postes de esquina.
   */
  private buildFrame(): void {
    const { width, depth, height } = PhoneBooth.SIZE;
    const post = PhoneBooth.POST;
    const floor = PhoneBooth.BASE.height;
    [-1, 1].forEach((sideX) => {
      [-1, 1].forEach((sideZ) => {
        const position = { x: (sideX * width) / 2, y: floor + height / 2, z: (sideZ * depth) / 2 };
        this.box({ x: post, y: height, z: post }, position, this.frame);
      });
    });
  }

  /**
   * Zócalo opaco y vidrio en los cuatro lados.
   */
  private buildWalls(): void {
    const { width, depth, height } = PhoneBooth.SIZE;
    const { height: panel, thickness } = PhoneBooth.PANEL;
    const floor = PhoneBooth.BASE.height;
    const pane = height - panel;
    PhoneBooth.SIDES.forEach(({ x: sideX, z: sideZ, quarter }) => {
      const span = quarter ? depth : width;
      const x = (sideX * width) / 2;
      const z = (sideZ * depth) / 2;
      const turn = quarter ? Math.PI / 2 : 0;
      const kick = this.box({ x: span, y: panel, z: thickness }, { x, y: floor + panel / 2, z }, this.frame);
      kick.rotation.y = turn;
      const sheet = new Mesh(new PlaneGeometry(span, pane), this.glass);
      this.add(sheet, { x, y: floor + panel + pane / 2, z }).rotation.y = turn;
    });
    this.buildHandle();
  }

  /**
   * Manija vertical de la puerta del frente.
   */
  private buildHandle(): void {
    const handle = PhoneBooth.HANDLE;
    const front = PhoneBooth.SIZE.depth / 2;
    const handleSize = { x: handle.width, y: handle.height, z: handle.depth };
    this.box(handleSize, { x: handle.x, y: handle.y, z: front }, this.frame);
  }

  /**
   * Franja luminosa "公衆電話" bajo el techo y el techo que sobresale.
   */
  private buildTop(): void {
    const { width, depth, height } = PhoneBooth.SIZE;
    const top = PhoneBooth.BASE.height + height;
    const sign = PhoneBooth.SIGN.height;
    this.sign.map = this.own(this.art.sign());
    this.box({ x: width, y: sign, z: depth }, { x: 0, y: top - sign / 2, z: 0 }, this.sign);
    const roof = PhoneBooth.ROOF;
    this.box(
      { x: roof.width, y: roof.height, z: roof.depth },
      { x: 0, y: top + roof.height / 2, z: 0 },
      this.frame,
    );
  }

  /**
   * Tubo fluorescente con su luz y teléfono en la pared del fondo.
   */
  private buildInterior(): void {
    const { radius, length, y } = PhoneBooth.TUBE;
    const tube = this.add(
      new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.Thin), this.tube),
      { x: 0, y, z: 0 },
    );
    tube.rotation.z = Math.PI / 2;
    this.add(this.light, { x: 0, y: PhoneBooth.LIGHT.y, z: PhoneBooth.LIGHT.z });
    const back = -PhoneBooth.SIZE.depth / 2;
    this.handset = this.add(this.phone.build(), {
      x: 0,
      y: PhoneBooth.PHONE.y,
      z: back + PhoneBooth.PHONE.inset,
    });
    this.buildShelf(back);
  }

  /**
   * Repisa bajo el teléfono con la guía telefónica encima.
   *
   * @param back Coordenada z de la pared del fondo.
   */
  private buildShelf(back: number): void {
    const shelf = PhoneBooth.SHELF;
    const shelfZ = back + shelf.depth / 2;
    this.box(
      { x: shelf.width, y: shelf.height, z: shelf.depth },
      { x: 0, y: shelf.y, z: shelfZ },
      this.frame,
    );
    const book = PhoneBooth.BOOK;
    const bookY = shelf.y + (shelf.height + book.height) / 2;
    const cover = new MeshStandardMaterial(PhoneBooth.FINISH.book);
    this.box({ x: book.width, y: book.height, z: book.depth }, { x: book.x, y: bookY, z: shelfZ }, cover);
  }

  /**
   * Aplica el brillo del tubo fluorescente y de su luz.
   *
   * @param flicker Factor de parpadeo (1 = estable).
   */
  private applyTube(flicker: number): void {
    const power = this.level * flicker;
    this.tube.color
      .set(PhoneBooth.TUBE.color)
      .multiplyScalar(Math.max(power * PhoneBooth.TUBE.glow, PhoneBooth.OFF_GLOW));
    this.light.intensity = power * PhoneBooth.LIGHT.intensity;
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Centro.
   * @param material Material.
   * @returns La caja.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): Mesh {
    return this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }
}
