import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Vector3,
  type Material,
  type Object3D,
  type Vector3Like,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { ScopeControlId } from '../../models/ScopeControlId';
import type { ScopeControlService } from '../../services/ScopeControlService';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { OscilloscopeDisplay } from './OscilloscopeDisplay';
import { OscilloscopePanel } from './OscilloscopePanel';
import { PanelArtPainter } from './PanelArtPainter';
import { ScopeKey } from './ScopeKey';
import { ScopeKnob } from './ScopeKnob';

/**
 * Osciloscopio digital de banco sobre la barra: carcasa gris carbón con ventilación lateral, panel frontal
 * serigrafiado, pantalla LCD a color con la respuesta del lazo PID en vivo, teclas de goma retroiluminadas,
 * perillas y entradas BNC. Sus teclas y perillas funcionan (ver {@link Oscilloscope.controls}): encendido,
 * RUN/STOP, SINGLE, AUTO, MENU, canales, ganancias del PID, generador de la referencia y escalas. La
 * pantalla no lleva vidrio ni se ve afectada por el tone mapping, así se lee igual desde cualquier ángulo.
 */
export class Oscilloscope extends SceneObject implements Updatable, Powerable {
  private static readonly POSITION = { x: -1.2, y: 1.09, z: 0.72 };
  private static readonly ROTATION_Y = 0.38;
  private static readonly BODY = { width: 0.41, height: 0.21, depth: 0.14, radius: 0.012, lift: 0.012 };
  private static readonly REAR = { width: 0.33, height: 0.16, depth: 0.1, radius: 0.02, overlap: 0.012 };
  private static readonly VENTS = {
    count: 8,
    spacing: 0.013,
    length: 0.08,
    thickness: 0.0035,
    inset: 0.0012,
    z: -0.012,
  };
  private static readonly FEET = [
    { x: -0.16, z: 0.04 },
    { x: 0.16, z: 0.04 },
    { x: -0.16, z: -0.04 },
    { x: 0.16, z: -0.04 },
  ];
  private static readonly FOOT = { width: 0.028, height: 0.012, depth: 0.02 };
  private static readonly KNOB_CAP = { color: 0x7d838c, roughness: 0.5, metalness: 0.55 };
  private static readonly FACE_OFFSET = 0.0006;
  private static readonly BEZEL_DEPTH = 0.003;
  private static readonly KNOB_DEPTH = 1.15;
  private static readonly BNC = { radius: 0.0055, collar: 0.0072, depth: 0.012, collarDepth: 0.004 };
  private static readonly USB = { width: 0.013, height: 0.005, depth: 0.002 };
  private static readonly LIGHT = { color: 0xcfe9ff, intensity: 0.3, distance: 1.1, z: 0.2 };
  private static readonly COLORS = {
    casing: 0x2a2d33,
    bezel: 0x050608,
    knob: 0x1b1d21,
    port: 0x0a0a0c,
    slot: 0x0d0e11,
  };
  private static readonly FINISH = { casing: 0.6, face: 0.55, bezel: 0.2 };
  private static readonly OFF_GLOW = 0.02;
  private static readonly REFRESH_RATE = 20;
  private static readonly BLINK_RATE = 1.5;
  private static readonly BOOT_SECONDS = 1.2;

  private readonly panel = new OscilloscopePanel();
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private readonly light = new PointLight(Oscilloscope.LIGHT.color, 0, Oscilloscope.LIGHT.distance, 2);
  private readonly display: OscilloscopeDisplay;
  private readonly painter: PanelArtPainter;
  private readonly keys: ScopeKey[] = [];
  private readonly dials: { id: ScopeControlId; knob: ScopeKnob }[] = [];
  private sinceRefresh = Infinity;
  private intro = 0;
  private powered: boolean;
  private bootStart: number | null = null;
  private bootPending = false;
  private dirty = true;

  /**
   * Crea el osciloscopio.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   * @param instrument Tablero del equipo: lazo PID y estado del osciloscopio.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    textures: CanvasTextureFactory,
    private readonly instrument: ScopeControlService,
  ) {
    super();
    this.display = new OscilloscopeDisplay(textures, instrument.loop, instrument.settings);
    this.painter = new PanelArtPainter(textures);
    this.powered = instrument.settings.state.powered;
  }

  /**
   * Teclas y perillas que el visitante puede usar, con la malla que recibe el puntero.
   *
   * @returns Controles.
   */
  public get controls(): readonly { id: ScopeControlId; hitArea: Object3D }[] {
    const keys = this.keys.flatMap((key) =>
      key.key.control ? [{ id: key.key.control, hitArea: key.hitArea }] : [],
    );
    return [...keys, ...this.dials.map(({ id, knob }) => ({ id, hitArea: knob.hitArea }))];
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.intro = level;
    this.refreshLights();
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.keys.forEach((key) => {
      key.update(delta);
    });
    this.sinceRefresh += delta;
    if (this.sinceRefresh < 1 / Oscilloscope.REFRESH_RATE) {
      return;
    }
    this.sinceRefresh = 0;
    this.refreshScreen(elapsed);
  }

  /**
   * Resalta el control señalado (o el que se está girando).
   *
   * @param id Control, o `null` para apagar todos.
   */
  public highlight(id: ScopeControlId | null): void {
    this.dials.forEach((entry) => {
      entry.knob.setHighlight(entry.id === id);
    });
    this.keys.forEach((key) => {
      key.setHighlight(key.key.control !== undefined && key.key.control === id);
    });
  }

  /**
   * Hunde la tecla de un control, como respuesta visual al pulsarla.
   *
   * @param id Control.
   */
  public pressKey(id: ScopeControlId): void {
    this.keys.find((key) => key.key.control === id)?.press();
  }

  /**
   * Punta del conector de CH1, en el mundo, donde se enchufa la sonda.
   *
   * @param target Vector donde se escribe el resultado.
   * @returns El mismo vector.
   */
  public probePort(target: Vector3): Vector3 {
    const [first] = this.panel.connectors();
    this.root.updateMatrixWorld(true);
    target.copy(this.front(first?.x ?? 0, first?.y ?? 0, Oscilloscope.BNC.depth));
    return this.root.localToWorld(target);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildCase();
    this.buildVents();
    this.buildFace();
    this.buildScreen();
    this.buildKeys();
    this.buildKnobs();
    this.buildConnectors();
    this.root.position.copy(Oscilloscope.POSITION);
    this.root.rotation.y = Oscilloscope.ROTATION_Y;
    this.setPower(0);
    this.syncKnobs();
    this.subscribe();
  }

  /**
   * Sigue los cambios del lazo (solo redibuja si está adquiriendo) y del equipo (siempre redibuja).
   */
  private subscribe(): void {
    const stopLoop = this.instrument.loop.onChange(() => {
      this.syncKnobs();
      this.dirty ||= this.instrument.settings.state.running;
    });
    const stopScope = this.instrument.settings.onChange(() => {
      this.onScopeChange();
    });
    this.own({ dispose: stopLoop });
    this.own({ dispose: stopScope });
  }

  /**
   * Refleja un cambio del equipo: perillas, luces y, al encender, la pantalla de arranque.
   */
  private onScopeChange(): void {
    const { powered } = this.instrument.settings.state;
    if (powered && !this.powered) {
      this.bootPending = true;
    }
    this.powered = powered;
    this.dirty = true;
    this.syncKnobs();
    this.refreshLights();
  }

  /**
   * Redibuja la pantalla según el estado: apagada, arrancando o funcionando (en STOP solo si algo cambió).
   *
   * @param elapsed Tiempo actual.
   */
  private refreshScreen(elapsed: number): void {
    if (!this.powered) {
      this.display.drawOff();
      return;
    }
    if (this.bootPending) {
      this.bootPending = false;
      this.bootStart = elapsed;
    }
    const booting = this.bootStart === null ? 1 : (elapsed - this.bootStart) / Oscilloscope.BOOT_SECONDS;
    if (booting < 1) {
      this.display.drawBoot(booting);
      return;
    }
    this.drawSignal(elapsed);
  }

  /**
   * Dibuja las trazas si está adquiriendo o si cambió algo; completa el disparo único.
   *
   * @param elapsed Tiempo actual.
   */
  private drawSignal(elapsed: number): void {
    const { running, single } = this.instrument.settings.state;
    if (!running && !this.dirty) {
      return;
    }
    this.dirty = false;
    this.display.draw(Math.sin(elapsed * Oscilloscope.BLINK_RATE * Math.PI * 2) > 0, running);
    if (single) {
      this.instrument.settings.finishSingle();
    }
  }

  /**
   * Luces de la pantalla, las teclas y los anillos de las perillas según el encendido.
   */
  private refreshLights(): void {
    const level = this.powered ? this.intro : 0;
    this.screen.color.setScalar(Math.max(level, Oscilloscope.OFF_GLOW));
    this.light.intensity = level * Oscilloscope.LIGHT.intensity;
    this.keys.forEach((key) => {
      const lamp = key.key.control ? this.instrument.lamp(key.key.control) : 'off';
      const lit = key.key.control === 'power' ? this.intro : level;
      key.setLight(lamp === 'off' ? 0 : lit, lamp === 'alert');
    });
    this.dials.forEach(({ knob }) => {
      knob.setAvailable(this.powered);
    });
  }

  /**
   * Gira cada perilla a la posición de su valor.
   */
  private syncKnobs(): void {
    this.dials.forEach(({ id, knob }) => {
      knob.setFraction(this.instrument.fraction(id));
    });
  }

  /**
   * Carcasa redondeada con la tapa trasera más angosta.
   */
  private buildCase(): void {
    const { width, height, depth, radius, lift } = Oscilloscope.BODY;
    const casing = new MeshStandardMaterial({
      color: Oscilloscope.COLORS.casing,
      roughness: Oscilloscope.FINISH.casing,
      metalness: 0.15,
    });
    this.add(new Mesh(new RoundedBoxGeometry(width, height, depth, 2, radius), casing), {
      x: 0,
      y: lift + height / 2,
      z: 0,
    });
    const rear = Oscilloscope.REAR;
    this.add(new Mesh(new RoundedBoxGeometry(rear.width, rear.height, rear.depth, 2, rear.radius), casing), {
      x: 0,
      y: lift + height / 2,
      z: -depth / 2 - rear.depth / 2 + rear.overlap,
    });
    this.buildFeet();
  }

  /**
   * Patas de goma.
   */
  private buildFeet(): void {
    const rubber = new MeshStandardMaterial({ color: Oscilloscope.COLORS.port, roughness: 0.9 });
    const { lift } = Oscilloscope.BODY;
    Oscilloscope.FEET.forEach(({ x, z }) => {
      this.box(Oscilloscope.FOOT, { x, y: lift / 2, z }, rubber);
    });
  }

  /**
   * Ranuras de ventilación en ambos costados.
   */
  private buildVents(): void {
    const { count, spacing, length, thickness, inset, z } = Oscilloscope.VENTS;
    const { width, height, lift } = Oscilloscope.BODY;
    const slot = new MeshStandardMaterial({ color: Oscilloscope.COLORS.slot, roughness: 0.9 });
    const first = lift + height / 2 - ((count - 1) * spacing) / 2;
    [-1, 1].forEach((side) => {
      for (let index = 0; index < count; index += 1) {
        const size = { width: inset * 2, height: thickness, depth: length };
        this.box(size, { x: side * (width / 2 - inset / 2), y: first + index * spacing, z }, slot);
      }
    });
  }

  /**
   * Panel frontal serigrafiado.
   */
  private buildFace(): void {
    const { width, height } = this.panel.face;
    const map = this.own(this.painter.paint(width, height, this.panel.art()));
    const face = new MeshStandardMaterial({ map, roughness: Oscilloscope.FINISH.face, metalness: 0.2 });
    this.add(new Mesh(new PlaneGeometry(width, height), face), this.front(0, 0, Oscilloscope.FACE_OFFSET));
  }

  /**
   * Marco negro brillante y pantalla LCD, con la luz que la pantalla proyecta sobre la barra.
   */
  private buildScreen(): void {
    const { x, y, width, height, frame } = this.panel.screen;
    const depth = Oscilloscope.BEZEL_DEPTH;
    const bezel = new MeshStandardMaterial({
      color: Oscilloscope.COLORS.bezel,
      roughness: Oscilloscope.FINISH.bezel,
      metalness: 0.3,
    });
    this.box(
      { width: width + frame * 2, height: height + frame * 2, depth },
      this.front(x, y, depth / 2),
      bezel,
    );
    this.screen.map = this.own(this.display.create());
    this.add(
      new Mesh(new PlaneGeometry(width, height), this.screen),
      this.front(x, y, depth + Oscilloscope.FACE_OFFSET),
    );
    this.add(this.light, this.front(x, y, Oscilloscope.LIGHT.z));
  }

  /**
   * Teclas de goma retroiluminadas.
   */
  private buildKeys(): void {
    this.panel.keys().forEach((key) => {
      const scopeKey = new ScopeKey(key, this.front(key.x, key.y, 0));
      this.keys.push(scopeKey);
      this.root.add(scopeKey.mesh);
    });
  }

  /**
   * Perillas: las que ajustan algo quedan registradas para el puntero.
   */
  private buildKnobs(): void {
    const body = new MeshStandardMaterial({ color: Oscilloscope.COLORS.knob, roughness: 0.45 });
    const cap = new MeshStandardMaterial(Oscilloscope.KNOB_CAP);
    this.panel.knobs().forEach(({ x, y, radius, control }) => {
      const knob = new ScopeKnob(
        radius,
        radius * Oscilloscope.KNOB_DEPTH,
        { body, cap },
        control !== undefined,
      );
      knob.group.position.copy(this.front(x, y, 0));
      this.root.add(knob.group);
      if (control) {
        this.dials.push({ id: control, knob });
      }
    });
  }

  /**
   * Entradas BNC (cuerpo niquelado con cuello) y puerto USB.
   */
  private buildConnectors(): void {
    const { radius, collar, depth, collarDepth } = Oscilloscope.BNC;
    this.panel.connectors().forEach(({ x, y }) => {
      this.cylinder(collar, collarDepth, this.front(x, y, collarDepth / 2), this.materials.darkMetal);
      this.cylinder(radius, depth, this.front(x, y, depth / 2), this.materials.metal);
    });
    const port = new MeshStandardMaterial({ color: Oscilloscope.COLORS.port, roughness: 0.5 });
    const { x, y } = this.panel.usb;
    this.box(Oscilloscope.USB, this.front(x, y, Oscilloscope.USB.depth / 2), port);
  }

  /**
   * Punto sobre la cara frontal, en coordenadas del panel.
   *
   * @param x Horizontal desde el centro del panel.
   * @param y Vertical desde el centro del panel.
   * @param offset Distancia hacia afuera desde la cara.
   * @returns Posición local.
   */
  private front(x: number, y: number, offset: number): Vector3 {
    const { height, depth, lift } = Oscilloscope.BODY;
    return new Vector3(x, lift + height / 2 + y, depth / 2 + offset);
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param size.width Ancho.
   * @param size.height Alto.
   * @param size.depth Profundidad.
   * @param position Centro.
   * @param material Material.
   */
  private box(
    size: { width: number; height: number; depth: number },
    position: Vector3Like,
    material: Material,
  ): void {
    this.add(new Mesh(new BoxGeometry(size.width, size.height, size.depth), material), position);
  }

  /**
   * Agrega un cilindro orientado hacia el frente.
   *
   * @param radius Radio.
   * @param length Largo hacia el frente.
   * @param position Centro.
   * @param material Material.
   */
  private cylinder(radius: number, length: number, position: Vector3Like, material: Material): void {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, GeometryDetail.Medium), material);
    mesh.rotation.x = Math.PI / 2;
    this.add(mesh, position);
  }
}
