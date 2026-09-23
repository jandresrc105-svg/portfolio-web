import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  type Material,
  type Object3D,
  type Texture,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { PanelState } from '../../models/PanelState';
import type { Powerable } from '../../models/Powerable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { BreakerPanelArt } from './BreakerPanelArt';
import { BreakerSwitch } from './BreakerSwitch';
import { EnergyMeter } from './EnergyMeter';
import { PanelLayout } from './PanelLayout';

/**
 * Tablero eléctrico del poste, la línea de tiempo de la trayectoria: gabinete con puerta de bisagra (placa de
 * advertencia y LEDs por fuera, sellos de inspección por dentro), breaker general MAIN, un breaker por etapa y,
 * al fondo, el diagrama del circuito. Al subir los breakers una chispa recorre el bus de nodo en nodo; si todos
 * están arriba llega a la carga final y el bombillo "HOY" se enciende. Debajo, el medidor de energía gira según
 * la carga y marca los años de experiencia.
 */
export class BreakerPanel extends SceneObject implements Updatable, Powerable {
  private static readonly POSITION = { x: -3.75, y: 1.5, z: -0.76 };
  private static readonly FINISH = {
    cabinet: { color: 0x7d8a86, roughness: 0.55, metalness: 0.5 },
    stage: { body: 0xe8e4d8, lever: 0x1c1f22 },
    main: { body: 0x2a2f33, lever: 0xd02a2a },
    rail: { color: 0xb8bec2, roughness: 0.35, metalness: 0.8 },
  };
  private static readonly DOOR = { thickness: 0.012, open: -1.95, rate: 6 };
  private static readonly HANDLE = { width: 0.018, height: 0.09, depth: 0.02, inset: 0.045 };
  private static readonly WARNING = { width: 0.16, height: 0.1, y: 0.2, lift: 0.001 };
  private static readonly LEDS = {
    size: 0.02,
    spacing: 0.045,
    y: 0.32,
    green: 0x22ff88,
    red: 0xff2233,
    blink: 3.2,
  };
  private static readonly RAIL = { height: 0.035, depth: 0.008 };
  private static readonly SPARK = { radius: 0.011, color: 0x9ffcff, glow: 8, speed: 2.4, lift: 0.004 };
  private static readonly BULB = { color: 0xffd08a, glow: 7, lift: 0.02 };
  private static readonly METER = { y: -0.6, z: -0.045 };
  private static readonly PLATE_GLOW = 0.9;
  private static readonly GLOW = 5;
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.25 };
  private static readonly SELF_LIGHT = 0.15;
  private static readonly OFF_GLOW = 0.04;

  private readonly layout = new PanelLayout();
  private readonly art: BreakerPanelArt;
  private readonly meter: EnergyMeter;
  private readonly door = new Group();
  private readonly doorMaterial = new MeshStandardMaterial(BreakerPanel.FINISH.cabinet);
  private readonly doorLeaf: Mesh;
  private readonly plate = new MeshBasicMaterial();
  private readonly inner = new MeshBasicMaterial();
  private readonly mainSwitch: BreakerSwitch;
  private readonly stages: BreakerSwitch[];
  private readonly sparkMaterial = new MeshBasicMaterial({ toneMapped: false });
  private readonly spark = new Mesh(
    new SphereGeometry(BreakerPanel.SPARK.radius, GeometryDetail.Low, GeometryDetail.Low),
    this.sparkMaterial,
  );
  private readonly bulb = new MeshBasicMaterial({ color: BreakerPanel.BULB.color });
  private readonly greenLed = new MeshBasicMaterial();
  private readonly redLed = new MeshBasicMaterial();
  private readonly textures: Texture[] = [];
  private readonly pieces = new Map<string, (active: boolean) => void>();
  private labels: readonly string[] = [];
  private state: PanelState = { open: false, main: true, breakers: [], energized: 0, selected: 0 };
  private level = 0;
  private angle = 0;
  private front = -1;
  private drawn = Number.NaN;

  /**
   * Crea el tablero.
   *
   * @param textures Fábrica de texturas.
   * @param ids Ids de los controles (puerta, MAIN y breaker de cada etapa).
   * @param ids.door Id de la puerta.
   * @param ids.main Id del MAIN.
   * @param ids.breaker Id del breaker de una etapa.
   */
  public constructor(
    textures: CanvasTextureFactory,
    private readonly ids: { door: string; main: string; breaker: (index: number) => string },
  ) {
    super();
    this.art = new BreakerPanelArt(textures);
    this.meter = new EnergyMeter(this.art);
    const { width, height } = PanelLayout.CABINET;
    this.doorLeaf = new Mesh(new BoxGeometry(width, height, BreakerPanel.DOOR.thickness), this.doorMaterial);
    const { body, lever } = BreakerPanel.FINISH.stage;
    this.mainSwitch = new BreakerSwitch(PanelLayout.MAIN, BreakerPanel.FINISH.main);
    this.stages = Array.from(
      { length: PanelLayout.SLOTS.capacity },
      () => new BreakerSwitch(PanelLayout.BREAKER, { body, lever }),
    );
  }

  /**
   * Zonas que reciben el puntero: la puerta, el MAIN y el breaker de cada hueco.
   *
   * @returns Pares control-malla.
   */
  public controls(): { id: string; hitArea: Object3D }[] {
    return [
      { id: this.ids.door, hitArea: this.doorLeaf },
      { id: this.ids.main, hitArea: this.mainSwitch.hitArea },
      ...this.stages.map((stage, index) => ({ id: this.ids.breaker(index), hitArea: stage.hitArea })),
    ];
  }

  /**
   * Fija las etapas (reparte sus breakers y escribe sus etiquetas) y los sellos de la puerta.
   *
   * @param labels Etiqueta de cada etapa.
   * @param seals Texto de cada sello.
   */
  public setDirectory(labels: readonly string[], seals: readonly string[]): void {
    this.labels = labels.slice(0, PanelLayout.SLOTS.capacity);
    this.stages.forEach((stage, index) => {
      stage.group.visible = index < this.labels.length;
      stage.group.position.x = this.layout.stageX(index, this.labels.length);
    });
    this.inner.map = this.replace(this.inner.map, this.art.seals(seals));
    this.inner.needsUpdate = true;
    this.drawn = Number.NaN;
  }

  /**
   * Refleja el estado: puerta, palancas y hasta dónde debe llegar la corriente.
   *
   * @param state Estado del tablero.
   */
  public setState(state: PanelState): void {
    const changed = state.selected !== this.state.selected;
    this.state = state;
    if (changed) {
      this.drawn = Number.NaN;
    }
    this.refreshSwitches();
  }

  /**
   * Muestra los años de experiencia en el medidor.
   *
   * @param years Años.
   */
  public setReading(years: number): void {
    this.meter.setReading(years, (previous, next) => this.replace(previous, next));
  }

  /**
   * Resalta el control señalado.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.pieces.forEach((apply, key) => {
      apply(key === id);
    });
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.plate.color.setScalar(Math.max(level * BreakerPanel.PLATE_GLOW, BreakerPanel.OFF_GLOW));
    this.inner.color.setScalar(Math.max(level * BreakerPanel.PLATE_GLOW, BreakerPanel.OFF_GLOW));
    this.refreshSwitches();
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    const { open, rate } = BreakerPanel.DOOR;
    const goal = this.state.open ? open : 0;
    this.angle += (goal - this.angle) * Math.min(delta * rate, 1);
    this.door.rotation.y = this.angle;
    this.mainSwitch.update(delta);
    this.stages.forEach((stage) => {
      stage.update(delta);
    });
    this.advance(delta);
    this.meter.update(delta);
    this.blink(elapsed);
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    super.dispose();
    this.textures.splice(0).forEach((texture) => {
      texture.dispose();
    });
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildCabinet();
    this.buildDoor();
    this.buildSwitches();
    this.buildCircuit();
    const meter = this.meter.build();
    meter.position.set(0, BreakerPanel.METER.y, BreakerPanel.METER.z);
    this.root.add(meter);
    this.root.position.copy(BreakerPanel.POSITION);
    this.setPower(0);
  }

  /**
   * Gabinete abierto por delante: fondo, paredes y la cara con el diagrama del circuito.
   */
  private buildCabinet(): void {
    const { width, height, depth, wall } = PanelLayout.CABINET;
    const metal = new MeshStandardMaterial(BreakerPanel.FINISH.cabinet);
    metal.emissive.set(BreakerPanel.FINISH.cabinet.color).multiplyScalar(BreakerPanel.SELF_LIGHT);
    this.box({ x: width, y: height, z: wall }, { x: 0, y: 0, z: (wall - depth) / 2 }, metal);
    [-1, 1].forEach((side) => {
      this.box({ x: width, y: wall, z: depth }, { x: 0, y: (side * (height - wall)) / 2, z: 0 }, metal);
      this.box({ x: wall, y: height, z: depth }, { x: (side * (width - wall)) / 2, y: 0, z: 0 }, metal);
    });
    const { width: plateWidth, height: plateHeight } = PanelLayout.PLATE;
    this.add(new Mesh(new PlaneGeometry(plateWidth, plateHeight), this.plate), {
      x: 0,
      y: 0,
      z: this.layout.plateZ(),
    });
  }

  /**
   * Puerta sobre su bisagra izquierda: placa de advertencia, manija y LEDs por fuera; sellos por dentro.
   */
  private buildDoor(): void {
    const { width, depth } = PanelLayout.CABINET;
    const thickness = BreakerPanel.DOOR.thickness;
    this.door.position.set(-width / 2, 0, depth / 2);
    this.doorLeaf.position.set(width / 2, 0, thickness / 2);
    const inside = new Mesh(new PlaneGeometry(PanelLayout.PLATE.width, PanelLayout.PLATE.height), this.inner);
    inside.rotation.y = Math.PI;
    inside.position.set(width / 2, 0, -BreakerPanel.WARNING.lift);
    this.door.add(this.doorLeaf, inside);
    this.buildDoorFront(thickness);
    this.root.add(this.door);
    this.pieces.set(this.ids.door, (active) => {
      const { color, strength } = BreakerPanel.HIGHLIGHT;
      this.doorMaterial.emissive.set(color).multiplyScalar(active ? strength : 0);
    });
  }

  /**
   * Frente de la puerta: placa amarilla, manija y los LEDs de estado (verde = MAIN, rojo = circuito abierto).
   *
   * @param thickness Grosor de la puerta.
   */
  private buildDoorFront(thickness: number): void {
    const { width } = PanelLayout.CABINET;
    const plate = BreakerPanel.WARNING;
    const warning = new MeshBasicMaterial({ map: this.track(this.art.warning()) });
    const sign = new Mesh(new PlaneGeometry(plate.width, plate.height), warning);
    sign.position.set(width / 2, plate.y, thickness + plate.lift);
    const handle = BreakerPanel.HANDLE;
    const grip = new Mesh(new BoxGeometry(handle.width, handle.height, handle.depth), this.doorMaterial);
    grip.position.set(width - handle.inset, 0, thickness + handle.depth / 2);
    this.door.add(sign, grip);
    const { size, spacing, y } = BreakerPanel.LEDS;
    [this.greenLed, this.redLed].forEach((material, index) => {
      const led = new Mesh(new BoxGeometry(size, size, size), material);
      led.position.set(width / 2 + (index - 1 / 2) * spacing * 2, y, thickness);
      this.door.add(led);
    });
  }

  /**
   * Riel DIN con el MAIN y un breaker por hueco (los que sobran quedan ocultos).
   */
  private buildSwitches(): void {
    const plateZ = this.layout.plateZ();
    const { y, depth } = PanelLayout.BREAKER;
    const rail = new MeshStandardMaterial(BreakerPanel.FINISH.rail);
    const { height, depth: railDepth } = BreakerPanel.RAIL;
    const left = PanelLayout.MAIN.x - PanelLayout.MAIN.width / 2;
    const right = PanelLayout.SLOTS.last + PanelLayout.BREAKER.width / 2;
    this.box(
      { x: right - left, y: height, z: railDepth },
      { x: (left + right) / 2, y, z: plateZ + railDepth / 2 },
      rail,
    );
    const main = this.mainSwitch.build();
    main.position.set(PanelLayout.MAIN.x, y, plateZ + PanelLayout.MAIN.depth / 2);
    this.root.add(main);
    this.pieces.set(this.ids.main, (active) => {
      this.mainSwitch.highlight(active);
    });
    this.buildStages(y, plateZ + depth / 2);
  }

  /**
   * Un breaker por hueco, ocultos hasta saber cuántas etapas hay.
   *
   * @param y Altura del riel.
   * @param z Profundidad del centro de los breakers.
   */
  private buildStages(y: number, z: number): void {
    this.stages.forEach((stage, index) => {
      const group = stage.build();
      group.position.set(this.layout.stageX(index, this.stages.length), y, z);
      group.visible = false;
      this.root.add(group);
      this.pieces.set(this.ids.breaker(index), (active) => {
        stage.highlight(active);
      });
    });
  }

  /**
   * Chispa que recorre el bus y bombillo de la carga final.
   */
  private buildCircuit(): void {
    const { x, radius } = PanelLayout.LOAD;
    const plateZ = this.layout.plateZ();
    const bulb = new Mesh(new SphereGeometry(radius, GeometryDetail.Low, GeometryDetail.Low), this.bulb);
    this.add(bulb, { x, y: PanelLayout.BUS_Y, z: plateZ + BreakerPanel.BULB.lift });
    this.sparkMaterial.color.set(BreakerPanel.SPARK.color).multiplyScalar(BreakerPanel.SPARK.glow);
    this.spark.visible = false;
    this.add(this.spark, { x: 0, y: PanelLayout.BUS_Y, z: plateZ + BreakerPanel.SPARK.lift });
  }

  /**
   * Nodo del bus al que debe llegar la corriente: -1 sin MAIN, luego cada etapa energizada y, con todas, la
   * carga final.
   *
   * @returns Índice del nodo.
   */
  private goal(): number {
    const { main, energized } = this.state;
    const count = this.labels.length;
    if (!main) {
      return -1;
    }
    return energized + (count > 0 && energized >= count ? 1 : 0);
  }

  /**
   * Avanza la corriente: sube de nodo en nodo con la chispa y cae de golpe al cortar. Redibuja el diagrama
   * solo al cambiar de nodo.
   *
   * @param delta Segundos desde el frame anterior.
   */
  private advance(delta: number): void {
    const goal = this.goal();
    if (this.front >= goal) {
      this.front = goal;
    } else {
      this.front = Math.min(goal, Math.max(this.front, 0) + delta * BreakerPanel.SPARK.speed);
    }
    const lit = Math.floor(this.front);
    if (lit !== this.drawn) {
      this.drawn = lit;
      this.redraw();
    }
    this.placeSpark(goal);
  }

  /**
   * Coloca la chispa entre el último nodo alcanzado y el siguiente (oculta si la corriente ya llegó).
   *
   * @param goal Nodo destino.
   */
  private placeSpark(goal: number): void {
    const moving = this.front >= 0 && this.front < goal;
    this.spark.visible = moving;
    if (!moving) {
      return;
    }
    const path = this.layout.path(this.labels.length);
    const from = Math.floor(this.front);
    const start = path[from] ?? 0;
    const end = path[from + 1] ?? start;
    this.spark.position.x = start + (end - start) * (this.front - from);
  }

  /**
   * Redibuja el diagrama, los LEDs de los breakers, el bombillo y el medidor según el nodo alcanzado.
   */
  private redraw(): void {
    const view = { labels: this.labels, lit: this.drawn, selected: this.state.selected };
    this.plate.map = this.replace(this.plate.map, this.art.plate(view));
    this.plate.needsUpdate = true;
    this.refreshSwitches();
  }

  /**
   * Palancas y LEDs de los breakers, bombillo final y velocidad del medidor.
   */
  private refreshSwitches(): void {
    const { main, breakers } = this.state;
    const lit = Number.isNaN(this.drawn) ? -1 : this.drawn;
    const count = this.labels.length;
    this.mainSwitch.apply(main, lit >= 0, this.level);
    this.stages.forEach((stage, index) => {
      stage.apply(breakers[index] ?? false, lit > index, this.level);
    });
    const closed = count > 0 && lit > count;
    const glow = closed ? this.level * BreakerPanel.BULB.glow : BreakerPanel.OFF_GLOW;
    this.bulb.color.set(BreakerPanel.BULB.color).multiplyScalar(glow);
    this.meter.setLoad(this.level, main && count > 0 ? Math.min(lit, count) / count : -1, closed);
  }

  /**
   * LEDs de la puerta: verde fijo con el MAIN arriba; rojo intermitente mientras el circuito está abierto.
   *
   * @param elapsed Segundos desde el inicio.
   */
  private blink(elapsed: number): void {
    const { green, red, blink } = BreakerPanel.LEDS;
    const { main } = this.state;
    const open = main && this.drawn <= this.labels.length;
    const on = open && Math.sin(elapsed * blink) > 0;
    const lit = (active: boolean): number =>
      active ? this.level * BreakerPanel.GLOW : BreakerPanel.OFF_GLOW;
    this.greenLed.color.set(green).multiplyScalar(Math.max(lit(main), BreakerPanel.OFF_GLOW));
    this.redLed.color.set(red).multiplyScalar(Math.max(lit(on), BreakerPanel.OFF_GLOW));
  }

  /**
   * Cambia una textura por otra y libera la anterior.
   *
   * @param previous Textura anterior.
   * @param next Textura nueva.
   * @returns La textura nueva.
   */
  private replace(previous: Texture | null, next: Texture): Texture {
    const index = previous ? this.textures.indexOf(previous) : -1;
    if (index >= 0) {
      previous?.dispose();
      this.textures.splice(index, 1);
    }
    return this.track(next);
  }

  /**
   * Registra una textura para liberarla al final.
   *
   * @param texture Textura.
   * @returns La misma textura.
   */
  private track(texture: Texture): Texture {
    this.textures.push(texture);
    return texture;
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Posición.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }
}
