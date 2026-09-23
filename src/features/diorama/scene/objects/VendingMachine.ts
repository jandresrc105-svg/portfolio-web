import {
  BoxGeometry,
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
  type Material,
  type Vector3,
  type Vector3Like,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Placement } from '../../models/Placement';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { VendingMachineArt } from './VendingMachineArt';
import { NeonTube } from './NeonTube';
import { VendingCans } from '../cans/VendingCans';
import { VendingMachineFixtures } from './VendingMachineFixtures';

/**
 * Máquina expendedora japonesa: carcasa azul metalizada, letrero superior, vitrina con vidrio y latas reales
 * en estantes, tiras de precios con botones "frío/caliente", ranura de monedas, bandeja y papeleras de reciclaje.
 * Cada lata representa una tecnología de la vitrina (4 estantes de 5): la elegida sale hacia el vidrio,
 * gira y se ilumina con un aro cian; al pasar el puntero sobre una lata, esta se adelanta un poco.
 * Tubos de neón enmarcan el letrero y la vitrina, y tiras LED iluminan cada estante. El vidrio es un reflejo
 * pintado (sin especular) para que la luz no deje destellos blancos sobre las latas.
 */
export class VendingMachine extends SceneObject implements Updatable, Powerable {
  private static readonly BODY = { width: 1, height: 1.9, depth: 0.78, radius: 0.035 };
  private static readonly FINISH = {
    body: { color: 0x1c3f8f, roughness: 0.32, metalness: 0.55 },
    frame: { color: 0x0c1a3a, roughness: 0.35, metalness: 0.7 },
    shelf: { color: 0x8a96ac, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.4 },
  };
  private static readonly HEADER = { width: 0.88, height: 0.2, y: 1.72, glow: 1.5 };
  private static readonly WINDOW = { width: 0.86, height: 1.14, depth: 0.12, y: 1, glow: 0.4 };
  private static readonly GLASS = { glow: 1 };
  private static readonly LED = {
    color: 0xeaf6ff,
    glow: 1.5,
    height: 0.008,
    depth: 0.012,
    inset: 0.025,
    drop: 0.068,
  };
  private static readonly TRIMS = [
    { width: 0.96, height: 1.24, corner: 0.04, y: 1, lift: 0.13, color: 0x5ee7ff },
    { width: 0.94, height: 0.25, corner: 0.035, y: 1.72, lift: 0.012, color: 0xff4fa3 },
  ];
  private static readonly TRIM = { thickness: 0.0065, glow: 2.4 };
  private static readonly SHELVES = [{ y: 1.29 }, { y: 1.03 }, { y: 0.77 }, { y: 0.51 }];
  private static readonly SHELF = { height: 0.012, depth: 0.1 };
  private static readonly FRAME_BAR = 0.03;
  private static readonly STRIP = { height: 0.055, glow: 1.2, offset: 0.03 };
  private static readonly LIGHT = { color: 0xd4ecff, intensity: 3.2, distance: 3.4, z: 1.1, y: 0.45 };
  private static readonly FOCUS = { x: -0.3, y: 1.13, front: 0.15 };
  private static readonly SELECTOR = { radius: 0.066, tube: 0.005, color: 0x5ee7ff, glow: 4, lift: 0.004 };
  private static readonly OFF_GLOW = 0.04;
  private static readonly FRONT_OFFSET = 0.002;

  private readonly header = new MeshBasicMaterial();
  private readonly back = new MeshBasicMaterial();
  private readonly strip = new MeshBasicMaterial();
  private readonly led = new MeshBasicMaterial();
  private readonly glass = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly trims = VendingMachine.TRIMS.map(
    (trim) => new NeonTube({ ...trim, ...VendingMachine.TRIM }),
  );
  private readonly light = new PointLight(VendingMachine.LIGHT.color, 0, VendingMachine.LIGHT.distance, 2);
  private readonly art: VendingMachineArt;
  private readonly cans: VendingCans;
  private readonly selector = new Mesh(
    new TorusGeometry(
      VendingMachine.SELECTOR.radius,
      VendingMachine.SELECTOR.tube,
      GeometryDetail.Thin,
      GeometryDetail.Ring,
    ),
    new MeshBasicMaterial(),
  );

  /**
   * Crea la máquina.
   *
   * @param textures Fábrica de texturas.
   * @param placement Dónde queda, junto a la fachada del taller.
   */
  public constructor(
    textures: CanvasTextureFactory,
    private readonly placement: Placement,
  ) {
    super();
    this.art = new VendingMachineArt(textures);
    this.cans = new VendingCans(
      textures,
      VendingMachine.SHELVES,
      this.front() + VendingMachine.SHELF.depth / 2,
    );
  }

  /**
   * Latas, para lanzarles el rayo del puntero.
   *
   * @returns Malla instanciada de las latas o `null` si aún no se construyó.
   */
  public get pickable(): Object3D | null {
    return this.cans.pickable;
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    const glow = (value: number): number => Math.max(level * value, VendingMachine.OFF_GLOW);
    this.header.color.setScalar(glow(VendingMachine.HEADER.glow));
    this.back.color.setScalar(glow(VendingMachine.WINDOW.glow));
    this.strip.color.setScalar(glow(VendingMachine.STRIP.glow));
    this.led.color.set(VendingMachine.LED.color).multiplyScalar(glow(VendingMachine.LED.glow));
    this.glass.color.setScalar(glow(VendingMachine.GLASS.glow));
    this.trims.forEach((trim) => {
      trim.setPower(level);
    });
    this.light.intensity = level * VendingMachine.LIGHT.intensity;
  }

  /**
   * Resalta la lata de un elemento de la vitrina.
   *
   * @param item Índice del elemento (desde 0).
   */
  public select(item: number): void {
    this.cans.select(item);
  }

  /**
   * Avisa si la cámara está en la vitrina: fuera de ella las latas descansan y el selector se apaga.
   *
   * @param focused `true` con la cámara en la vitrina.
   */
  public setFocused(focused: boolean): void {
    this.cans.setFocused(focused);
  }

  /**
   * Fija los elementos de la vitrina: solo sus latas responden al puntero y cada una lleva su sabor.
   *
   * @param flavors Sabor de la lata de cada elemento, en orden.
   */
  public setItems(flavors: readonly string[]): void {
    this.cans.setItems(flavors);
  }

  /**
   * Nombre impreso en la lata de un elemento.
   *
   * @param item Índice del elemento.
   * @returns Nombre (p. ej. "TypeScript").
   */
  public nameOf(item: number): string {
    return this.cans.nameOf(item);
  }

  /**
   * Elemento de la vitrina que representa una lata.
   *
   * @param can Índice de la lata (`instanceId` del impacto).
   * @returns Índice del elemento o `null` si la lata no representa ninguno.
   */
  public itemAt(can: number): number | null {
    return this.cans.itemAt(can);
  }

  /**
   * Adelanta un poco la lata de un elemento mientras el puntero está encima.
   *
   * @param item Índice del elemento o `null` para soltarla.
   */
  public hover(item: number | null): void {
    this.cans.hover(item);
  }

  /**
   * Punto del mundo al que mira la cámara en la vitrina: fijo (no cambia con la lata elegida, para que
   * la pantalla no se mueva al recorrer las latas), a la altura de la vitrina para que el letrero siga a la vista
   * y un poco a su izquierda para que la tarjeta de la página no la tape.
   *
   * @param target Vector donde se escribe el resultado.
   * @returns El mismo vector.
   */
  public focusPoint(target: Vector3): Vector3 {
    const { x, y, front } = VendingMachine.FOCUS;
    target.set(x, y, this.front() + front);
    this.root.updateMatrixWorld();
    return this.root.localToWorld(target);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    this.cans.update(delta);
    this.selector.visible = this.cans.selectedBase(this.selector.position);
    this.selector.position.y += VendingMachine.SELECTOR.lift;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { width, height, depth, radius } = VendingMachine.BODY;
    const body = new MeshStandardMaterial(VendingMachine.FINISH.body);
    const shell = new RoundedBoxGeometry(width, height, depth, 2, radius);
    this.add(new Mesh(shell, body), { x: 0, y: height / 2, z: 0 });
    this.buildHeader();
    this.buildWindow();
    this.add(this.cans.build((texture) => this.own(texture)));
    this.root.add(new VendingMachineFixtures(this.front()).build());
    this.buildTrims();
    this.buildSelector();
    this.add(this.light, { x: 0, y: VendingMachine.LIGHT.y, z: VendingMachine.LIGHT.z });
    this.root.position.copy(this.placement.position);
    this.root.rotation.y = this.placement.rotationY;
    this.settle(this.selector);
    this.setPower(0);
  }

  /**
   * Letrero luminoso superior.
   */
  private buildHeader(): void {
    const { width, height, y } = VendingMachine.HEADER;
    this.header.map = this.own(this.art.header());
    this.add(new Mesh(new PlaneGeometry(width, height), this.header), { x: 0, y, z: this.front() });
  }

  /**
   * Vitrina saliente: fondo iluminado, marco, estantes, tiras de precios y vidrio al frente.
   */
  private buildWindow(): void {
    const { width, height, depth, y } = VendingMachine.WINDOW;
    const inner = this.front();
    this.back.map = this.own(this.art.back());
    this.add(new Mesh(new PlaneGeometry(width, height), this.back), { x: 0, y, z: inner });
    this.buildFrame(inner);
    this.strip.map = this.own(this.art.strip());
    VendingMachine.SHELVES.forEach((shelf) => {
      this.buildShelf(shelf.y, inner);
    });
    this.buildLeds(inner);
    this.glass.map = this.own(this.art.glass());
    this.add(new Mesh(new PlaneGeometry(width, height), this.glass), { x: 0, y, z: inner + depth });
  }

  /**
   * Tiras LED en el techo de cada compartimento (bajo el estante de arriba o el marco), al frente.
   *
   * @param inner Profundidad del fondo de la vitrina.
   */
  private buildLeds(inner: number): void {
    const { width, depth, height: windowHeight, y: windowY } = VendingMachine.WINDOW;
    const { height, depth: ledDepth, inset, drop } = VendingMachine.LED;
    const geometry = new BoxGeometry(width - inset * 2, height, ledDepth);
    VendingMachine.SHELVES.forEach((_, index) => {
      const ceiling = VendingMachine.SHELVES[index - 1]?.y ?? windowY + windowHeight / 2;
      this.add(new Mesh(geometry.clone(), this.led), { x: 0, y: ceiling - drop, z: inner + depth - inset });
    });
    geometry.dispose();
  }

  /**
   * Tubos de neón alrededor de la vitrina (cian) y del letrero (magenta).
   */
  private buildTrims(): void {
    VendingMachine.TRIMS.forEach(({ y, lift }, index) => {
      const tube = this.trims[index];
      if (tube) {
        this.add(tube.mesh, { x: 0, y, z: this.front() + lift });
      }
    });
  }

  /**
   * Marco oscuro alrededor de la vitrina.
   *
   * @param inner Profundidad del fondo de la vitrina.
   */
  private buildFrame(inner: number): void {
    const { width, height, depth, y } = VendingMachine.WINDOW;
    const bar = VendingMachine.FRAME_BAR;
    const frame = new MeshStandardMaterial(VendingMachine.FINISH.frame);
    const z = inner + depth / 2;
    [y - height / 2, y + height / 2].forEach((barY) => {
      this.box({ x: width + bar * 2, y: bar, z: depth }, { x: 0, y: barY, z }, frame);
    });
    [-width / 2, width / 2].forEach((x) => {
      this.box({ x: bar, y: height, z: depth }, { x, y, z }, frame);
    });
  }

  /**
   * Estante metálico con su tira de precios al frente.
   *
   * @param y Altura del estante.
   * @param inner Profundidad del fondo de la vitrina.
   */
  private buildShelf(y: number, inner: number): void {
    const { width, depth } = VendingMachine.WINDOW;
    const { height, depth: shelfDepth } = VendingMachine.SHELF;
    const metal = new MeshStandardMaterial(VendingMachine.FINISH.shelf);
    this.box({ x: width, y: height, z: shelfDepth }, { x: 0, y, z: inner + shelfDepth / 2 }, metal);
    const strip = VendingMachine.STRIP;
    this.add(new Mesh(new PlaneGeometry(width, strip.height), this.strip), {
      x: 0,
      y: y - strip.offset,
      z: inner + depth - VendingMachine.FRONT_OFFSET,
    });
  }

  /**
   * Aro luminoso que marca la lata elegida.
   */
  private buildSelector(): void {
    const { color, glow } = VendingMachine.SELECTOR;
    this.selector.material.color.set(color).multiplyScalar(glow);
    this.selector.rotation.x = Math.PI / 2;
    this.selector.visible = false;
    this.add(this.selector);
  }

  /**
   * Profundidad de la cara frontal.
   *
   * @returns Coordenada z local del frente.
   */
  private front(): number {
    return VendingMachine.BODY.depth / 2 + VendingMachine.FRONT_OFFSET;
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Centro.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }
}
