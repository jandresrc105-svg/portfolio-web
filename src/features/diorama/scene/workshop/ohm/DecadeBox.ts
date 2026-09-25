import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { OhmDisplays } from '../OhmDisplays';
import type { OhmLabArt } from './OhmLabArt';

/**
 * Década de resistencias: gabinete con cuatro perillas rotativas (×1k, ×100, ×10, ×1) de diez posiciones con
 * su escala serigrafiada, el display rojo con el valor y dos bornes al frente de donde salen los cables del
 * circuito. Cada perilla gira suave hasta su detención. Se construye en un grupo con origen en el centro del
 * gabinete; la cara de las perillas es la de arriba (+y).
 */
export class DecadeBox {
  public static readonly BODY = { width: 0.26, height: 0.07, depth: 0.13, color: 0x2b3036 };
  private static readonly PANEL = { width: 0.25, depth: 0.12, lift: 0.001 };
  private static readonly KNOBS = [{ x: -0.09 }, { x: -0.03 }, { x: 0.03 }, { x: 0.09 }];
  private static readonly KNOB = { radius: 0.012, taper: 0.9, height: 0.016, z: 0.02, color: 0x131518 };
  private static readonly SKIRT = { radius: 0.0145, height: 0.004, color: 0xa9b0b8 };
  private static readonly POINTER = { width: 0.0028, height: 0.0015, length: 0.009, color: 0xf2f2ec };
  private static readonly DIAL = { radius: 0.015, start: -0.75, sweep: 1.5, steps: 10 };
  private static readonly HIT = { radius: 0.02, height: 0.03 };
  private static readonly DISPLAY = { width: 0.1, height: 0.025, x: -0.07, z: -0.038, lift: 0.002 };
  private static readonly SCREEN = { glow: 1.3, off: 0.05 };
  private static readonly TERMINALS = [
    { x: 0.1, color: 0xd02a2a },
    { x: 0.075, color: 0x16181b },
  ];
  private static readonly TERMINAL = { radius: 0.0055, depth: 0.014, y: -0.008 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.45 };
  private static readonly TURN_RATE = 14;

  public readonly group = new Group();
  public readonly hitAreas: Mesh[] = [];

  private readonly knobs: Group[] = [];
  private readonly caps: MeshStandardMaterial[] = [];
  private readonly targets = DecadeBox.KNOBS.map(() => 0);
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private shown = -1;

  /**
   * Crea la década.
   *
   * @param art Serigrafías fijas.
   * @param displays Pintor del display.
   */
  public constructor(
    private readonly art: OhmLabArt,
    private readonly displays: OhmDisplays,
  ) {}

  /**
   * Construye el gabinete, el panel, las perillas, el display y los bornes.
   *
   * @param labels Multiplicador de cada perilla (×1k, ×100…).
   * @returns Grupo de la década.
   */
  public build(labels: readonly string[]): Group {
    const { width, height, depth, color } = DecadeBox.BODY;
    const body = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.4, envMapIntensity: 0.5 });
    this.group.add(new Mesh(new BoxGeometry(width, height, depth), body));
    this.buildPanel(labels);
    DecadeBox.KNOBS.forEach(({ x }) => {
      this.buildKnob(x);
    });
    this.buildTerminals();
    return this.group;
  }

  /**
   * Punta de un borne (0 = rojo, 1 = negro) en el espacio del grupo, de donde sale su cable.
   *
   * @param index Borne.
   * @returns Punta del borne.
   */
  public terminal(index: number): Vector3 {
    const x = DecadeBox.TERMINALS[index]?.x ?? 0;
    const { y, depth } = DecadeBox.TERMINAL;
    return new Vector3(x, y, DecadeBox.BODY.depth / 2 + depth);
  }

  /**
   * Fija las posiciones de las perillas y el valor del display (redibuja solo si cambió).
   *
   * @param digits Posición 0–9 de cada perilla.
   * @param ohms Resistencia total.
   * @param level Brillo general (encendido de la escena).
   */
  public show(digits: readonly number[], ohms: number, level: number): void {
    digits.forEach((digit, index) => {
      this.targets[index] = DecadeBox.angle(digit);
    });
    if (ohms !== this.shown) {
      this.shown = ohms;
      this.replace(this.displays.decade(ohms));
    }
    const { glow, off } = DecadeBox.SCREEN;
    this.screen.color.setScalar(Math.max(level * glow, off));
  }

  /**
   * Gira cada perilla hacia su detención.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const blend = 1 - Math.exp(-DecadeBox.TURN_RATE * delta);
    this.knobs.forEach((knob, index) => {
      const target = -(this.targets[index] ?? 0);
      knob.rotation.y += (target - knob.rotation.y) * blend;
    });
  }

  /**
   * Resalta una perilla (o ninguna).
   *
   * @param index Perilla o -1.
   */
  public highlight(index: number): void {
    const { color, strength } = DecadeBox.HIGHLIGHT;
    this.caps.forEach((cap, current) => {
      cap.emissive.set(color).multiplyScalar(current === index ? strength : 0);
    });
  }

  /**
   * Libera la textura del display.
   */
  public dispose(): void {
    this.screen.map?.dispose();
  }

  /**
   * Panel superior serigrafiado y la ventana del display.
   *
   * @param labels Multiplicador de cada perilla.
   */
  private buildPanel(labels: readonly string[]): void {
    const { width, depth, lift } = DecadeBox.PANEL;
    const top = DecadeBox.BODY.height / 2;
    const knobs = DecadeBox.KNOBS.map(({ x }, index) => ({
      u: x / width + 0.5,
      v: DecadeBox.KNOB.z / depth + 0.5,
      label: labels[index] ?? '',
    }));
    const map = this.art.decadePanel(knobs, DecadeBox.DIAL.radius / depth);
    const panel = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshStandardMaterial({ map, roughness: 0.7, envMapIntensity: 0.2 }),
    );
    panel.rotation.x = -Math.PI / 2;
    panel.position.y = top + lift;
    this.group.add(panel, this.display(top));
  }

  /**
   * Ventana del display sobre el panel.
   *
   * @param top Altura de la cara superior.
   * @returns Malla del display.
   */
  private display(top: number): Mesh {
    const display = DecadeBox.DISPLAY;
    const screen = new Mesh(new PlaneGeometry(display.width, display.height), this.screen);
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(display.x, top + display.lift, display.z);
    return screen;
  }

  /**
   * Perilla: faldón metálico, cuerpo negro con su raya indicadora y la zona invisible que recibe el puntero.
   *
   * @param x Posición horizontal en el panel.
   */
  private buildKnob(x: number): void {
    const knob = new Group();
    knob.position.set(x, DecadeBox.BODY.height / 2, DecadeBox.KNOB.z);
    const { radius, taper, height, color } = DecadeBox.KNOB;
    const skirt = DecadeBox.SKIRT;
    const cap = new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.2 });
    const metal = new MeshStandardMaterial({ color: skirt.color, roughness: 0.3, metalness: 0.8 });
    const base = new Mesh(
      new CylinderGeometry(skirt.radius, skirt.radius, skirt.height, GeometryDetail.Low),
      metal,
    );
    base.position.y = skirt.height / 2;
    const body = new Mesh(new CylinderGeometry(radius * taper, radius, height, GeometryDetail.Low), cap);
    body.position.y = skirt.height + height / 2;
    knob.add(base, body, DecadeBox.pointer(skirt.height + height));
    this.knobs.push(knob);
    this.caps.push(cap);
    this.group.add(knob, this.hitArea(x));
  }

  /**
   * Zona invisible que recibe el puntero sobre una perilla.
   *
   * @param x Posición horizontal en el panel.
   * @returns Malla invisible.
   */
  private hitArea(x: number): Mesh {
    const { radius, height } = DecadeBox.HIT;
    const hit = new Mesh(
      new CylinderGeometry(radius, radius, height, GeometryDetail.Hitbox),
      new MeshBasicMaterial({ visible: false }),
    );
    hit.position.set(x, DecadeBox.BODY.height / 2 + height / 2, DecadeBox.KNOB.z);
    this.hitAreas.push(hit);
    return hit;
  }

  /**
   * Bornes rojo y negro en el frente.
   */
  private buildTerminals(): void {
    const { radius, depth, y } = DecadeBox.TERMINAL;
    const front = DecadeBox.BODY.depth / 2;
    DecadeBox.TERMINALS.forEach(({ x, color }) => {
      const material = new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
      const post = new Mesh(new CylinderGeometry(radius, radius, depth, GeometryDetail.Low), material);
      post.rotation.x = Math.PI / 2;
      post.position.set(x, y, front + depth / 2);
      this.group.add(post);
    });
  }

  /**
   * Cambia la textura del display y libera la anterior.
   *
   * @param texture Textura nueva.
   */
  private replace(texture: Texture): void {
    this.screen.map?.dispose();
    this.screen.map = texture;
    this.screen.needsUpdate = true;
  }

  /**
   * Raya indicadora blanca sobre la perilla (apunta a −z con la perilla en 0°).
   *
   * @param y Altura de la cara superior de la perilla.
   * @returns Malla de la raya.
   */
  private static pointer(y: number): Mesh {
    const pointer = DecadeBox.POINTER;
    const line = new Mesh(
      new BoxGeometry(pointer.width, pointer.height, pointer.length),
      new MeshBasicMaterial({ color: pointer.color }),
    );
    line.position.set(0, y, -pointer.length / 2);
    return line;
  }

  /**
   * Ángulo de la raya de una perilla en su escala (de −135° a +135°, en sentido horario visto desde arriba).
   *
   * @param digit Posición 0–9.
   * @returns Ángulo en radianes.
   */
  private static angle(digit: number): number {
    const { start, sweep, steps } = DecadeBox.DIAL;
    return (start + (sweep * digit) / (steps - 1)) * Math.PI;
  }
}
