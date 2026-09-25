import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
  type Texture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { RadioControl } from '../../models/RadioControl';
import type { RadioHandle } from '../../models/RadioHandle';
import { RadioMode } from '../../models/RadioMode';
import type { RadioState } from '../../models/RadioState';
import type { MaterialLibrary } from '../MaterialLibrary';
import { RadioPanelArt } from './RadioPanelArt';

/**
 * Receptor de radio de onda corta: gabinete oscuro con mejillas de madera, dial redondo con la escala
 * iluminada y la aguja roja, perilla de sintonía grande, rejilla del parlante, botón de encendido, tecla
 * de modo y los LED de encendido, AM, CW y señal (que parpadea con el morse). Se construye en un grupo con
 * origen en el centro del gabinete; el frente mira a +z.
 */
export class RadioReceiver {
  public static readonly BODY = { width: 0.36, height: 0.17, depth: 0.22, color: 0x2a2d31 };

  private static readonly CHEEK = { width: 0.012, grow: 0.006 };
  private static readonly FRONT = { lift: 0.001, background: '#1f2226', ink: '#c9ced6' };
  private static readonly DIAL = { x: -0.07, y: 0.004, radius: 0.062, glow: 1.5, off: 0.07, rate: 10 };
  private static readonly BEZEL = { tube: 0.005, color: 0xc8ccd2 };
  private static readonly NEEDLE = { length: 0.054, width: 0.0028, color: 0xff3b2f, glow: 3, off: 0.45 };
  private static readonly HUB = { radius: 0.007, depth: 0.006, color: 0x121315 };
  private static readonly KNOB = {
    x: 0.058,
    y: 0.004,
    radius: 0.03,
    depth: 0.024,
    turns: 3,
    taper: 0.9,
    color: 0x17191c,
  };
  private static readonly GRIP = { width: 0.004, height: 0.018, depth: 0.002, color: 0xd9dde2 };
  private static readonly SPEAKER = { x: 0.138, y: 0.004, radius: 0.032 };
  private static readonly POWER = { x: -0.158, y: -0.056, radius: 0.011, depth: 0.01, color: 0xb8322a };
  private static readonly MODE = {
    x: 0.058,
    y: -0.062,
    width: 0.036,
    height: 0.016,
    depth: 0.01,
    color: 0x3a3f46,
  };
  private static readonly LED = { size: 0.007, depth: 0.0035, glow: 5, off: 0.05 };
  private static readonly LEDS = {
    power: { x: -0.158, y: 0.058, color: 0x3dff7a },
    am: { x: 0.036, y: 0.06, color: 0xffb000 },
    cw: { x: 0.08, y: 0.06, color: 0xffb000 },
    signal: { x: 0.138, y: 0.06, color: 0xff3b2f },
  };
  private static readonly SIGNAL = 0.3;
  private static readonly LABEL = { small: 11, brand: 12 };
  private static readonly LABELS = [
    { text: 'ON', x: -0.158, y: 0.074 },
    { text: 'POWER', x: -0.158, y: -0.074 },
    { text: 'AM', x: 0.036, y: 0.074 },
    { text: 'CW', x: 0.08, y: 0.074 },
    { text: 'SIG', x: 0.138, y: 0.074 },
    { text: 'TUNE', x: 0.058, y: 0.045 },
    { text: 'MODE', x: 0.058, y: -0.079 },
    { text: 'JR-40 · RECEPTOR SDR', x: -0.07, y: 0.076 },
    { text: '40 m · 7.0–7.3 MHz', x: -0.07, y: -0.074 },
  ];
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.3 };

  public readonly group = new Group();

  private readonly body = new MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.35,
    envMapIntensity: 0.5,
  });
  private readonly panel = new MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.4,
    envMapIntensity: 0.4,
  });
  private readonly chrome = new MeshStandardMaterial({ roughness: 0.25, metalness: 1, envMapIntensity: 0.6 });
  private readonly face = new MeshBasicMaterial({ toneMapped: false });
  private readonly needleMaterial = new MeshBasicMaterial({ toneMapped: false });
  private readonly knobMaterial = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.3 });
  private readonly powerMaterial = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });
  private readonly modeMaterial = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.2 });
  private readonly grilleMaterial = new MeshStandardMaterial({ roughness: 0.7, metalness: 0.4 });
  private readonly leds = new Map<keyof typeof RadioReceiver.LEDS, MeshBasicMaterial>();
  private readonly needle = new Group();
  private readonly knob = new Group();
  private readonly handles: RadioHandle[] = [];
  private shown = 0;

  /**
   * Crea el receptor.
   *
   * @param art Pintor de las texturas fijas.
   * @param materials Materiales compartidos (madera de las mejillas).
   * @param band Banda y emisoras para la escala del dial.
   * @param band.from Borde inferior en kHz.
   * @param band.to Borde superior en kHz.
   * @param band.name Nombre de la banda.
   * @param band.stations Frecuencias de las emisoras.
   */
  public constructor(
    private readonly art: RadioPanelArt,
    private readonly materials: MaterialLibrary,
    private readonly band: { from: number; to: number; name: string; stations: readonly number[] },
  ) {
    this.body.color.set(RadioReceiver.BODY.color);
    this.chrome.color.set(RadioReceiver.BEZEL.color);
  }

  /**
   * Controles del receptor.
   *
   * @returns Controles con su material de resaltado.
   */
  public get controls(): readonly RadioHandle[] {
    return this.handles;
  }

  /**
   * Construye el gabinete y su frente.
   *
   * @returns Texturas creadas (para liberarlas con la pieza).
   */
  public build(): Texture[] {
    const { width, height, depth } = RadioReceiver.BODY;
    this.group.add(new Mesh(new BoxGeometry(width, height, depth), this.body));
    this.buildCheeks();
    const textures = [this.buildFront(), this.buildDial(), this.buildSpeaker()];
    this.buildKnob();
    this.buildButtons();
    this.buildLeds();
    return textures;
  }

  /**
   * Mueve la aguja y la perilla y enciende el dial y los LED según el estado.
   *
   * @param state Estado del receptor.
   * @param level Brillo general (encendido de la escena).
   * @param delta Segundos desde el frame anterior.
   */
  public show(state: RadioState, level: number, delta: number): void {
    const { glow, off, rate } = RadioReceiver.DIAL;
    this.shown += (state.dial - this.shown) * Math.min(rate * delta, 1);
    const { from, to } = RadioPanelArt.SWEEP;
    this.needle.rotation.z = from + (to - from) * this.shown;
    this.knob.rotation.z = -this.shown * RadioReceiver.KNOB.turns * Math.PI * 2;
    this.face.color.setScalar(state.on ? Math.max(level * glow, off) : off);
    const needle = RadioReceiver.NEEDLE;
    this.needleMaterial.color
      .set(needle.color)
      .multiplyScalar(state.on ? Math.max(level * needle.glow, needle.off) : needle.off);
    const heard = state.keyed || (state.mode === RadioMode.Am && state.signal > RadioReceiver.SIGNAL);
    this.light('power', state.on, level);
    this.light('am', state.on && state.mode === RadioMode.Am, level);
    this.light('cw', state.on && state.mode === RadioMode.Cw, level);
    this.light('signal', heard, level);
  }

  /**
   * Resalta un control del receptor.
   *
   * @param id Control señalado, o `null`.
   */
  public highlight(id: string | null): void {
    const { color, strength } = RadioReceiver.HIGHLIGHT;
    this.handles.forEach((handle) => {
      handle.glow.emissive.set(color).multiplyScalar(handle.id === id ? strength : 0);
    });
  }

  /**
   * Mejillas de madera a los lados del gabinete.
   */
  private buildCheeks(): void {
    const { width, height, depth } = RadioReceiver.BODY;
    const { width: thickness, grow } = RadioReceiver.CHEEK;
    const geometry = new BoxGeometry(thickness, height + grow, depth + grow);
    [-1, 1].forEach((side) => {
      const cheek = new Mesh(geometry, this.materials.woodDark);
      cheek.position.x = side * (width / 2 + thickness / 2);
      this.group.add(cheek);
    });
  }

  /**
   * Frente serigrafiado.
   *
   * @returns Textura del frente.
   */
  private buildFront(): Texture {
    const { width, height, depth } = RadioReceiver.BODY;
    const { lift, background, ink } = RadioReceiver.FRONT;
    const { small, brand } = RadioReceiver.LABEL;
    const labels = RadioReceiver.LABELS.map((label, index) => ({
      ...label,
      size: index >= RadioReceiver.LABELS.length - 2 ? brand : small,
    }));
    const texture = this.art.plate(
      { width, height },
      { background, ink, copper: null },
      { labels, traces: [] },
    );
    this.panel.map = texture;
    const front = new Mesh(new PlaneGeometry(width, height), this.panel);
    front.position.z = depth / 2 + lift;
    this.group.add(front);
    return texture;
  }

  /**
   * Dial iluminado con su bisel cromado, la aguja y el eje.
   *
   * @returns Textura de la escala.
   */
  private buildDial(): Texture {
    const { x, y, radius } = RadioReceiver.DIAL;
    const front = RadioReceiver.BODY.depth / 2 + RadioReceiver.FRONT.lift * 2;
    const texture = this.art.dial(this.band, this.band.stations);
    this.face.map = texture;
    const face = new Mesh(new CircleGeometry(radius, GeometryDetail.Ring), this.face);
    face.position.set(x, y, front);
    const bezel = new Mesh(
      new TorusGeometry(radius, RadioReceiver.BEZEL.tube, GeometryDetail.Thin, GeometryDetail.Ring),
      this.chrome,
    );
    bezel.position.set(x, y, front);
    this.buildNeedle(x, y, front);
    this.group.add(face, bezel);
    this.handles.push({ id: RadioControl.Dial, hitArea: face, glow: this.knobMaterial });
    return texture;
  }

  /**
   * Aguja roja que gira desde el centro del dial, con su eje.
   *
   * @param x Centro del dial.
   * @param y Centro del dial.
   * @param front Cara del dial.
   */
  private buildNeedle(x: number, y: number, front: number): void {
    const { length, width } = RadioReceiver.NEEDLE;
    const geometry = new BoxGeometry(length, width, width / 2);
    geometry.translate(length / 2, 0, 0);
    this.needle.add(new Mesh(geometry, this.needleMaterial));
    this.needle.position.set(x, y, front + width);
    const hub = RadioReceiver.HUB;
    const cap = new Mesh(
      new CylinderGeometry(hub.radius, hub.radius, hub.depth, GeometryDetail.Low),
      new MeshStandardMaterial({ color: hub.color, roughness: 0.4, metalness: 0.6 }),
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.set(x, y, front + hub.depth / 2);
    this.group.add(this.needle, cap);
  }

  /**
   * Perilla de sintonía con su marca (se ve girar).
   */
  private buildKnob(): void {
    const { x, y, radius, depth, color, taper } = RadioReceiver.KNOB;
    this.knobMaterial.color.set(color);
    const cylinder = new Mesh(
      new CylinderGeometry(radius, radius * taper, depth, GeometryDetail.High),
      this.knobMaterial,
    );
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.z = depth / 2;
    const grip = RadioReceiver.GRIP;
    const mark = new Mesh(
      new BoxGeometry(grip.width, grip.height, grip.depth),
      new MeshStandardMaterial({ color: grip.color, roughness: 0.4 }),
    );
    mark.position.set(0, radius - grip.height / 2, depth + grip.depth / 2);
    this.knob.add(cylinder, mark);
    this.knob.position.set(x, y, RadioReceiver.BODY.depth / 2);
    this.group.add(this.knob);
    this.handles.push({ id: RadioControl.Dial, hitArea: cylinder, glow: this.knobMaterial });
  }

  /**
   * Rejilla del parlante.
   *
   * @returns Textura de la rejilla.
   */
  private buildSpeaker(): Texture {
    const { x, y, radius } = RadioReceiver.SPEAKER;
    const texture = this.art.grille();
    this.grilleMaterial.map = texture;
    const grille = new Mesh(new CircleGeometry(radius, GeometryDetail.High), this.grilleMaterial);
    grille.position.set(x, y, RadioReceiver.BODY.depth / 2 + RadioReceiver.FRONT.lift * 2);
    this.group.add(grille);
    this.handles.push({ id: RadioControl.Speaker, hitArea: grille, glow: this.grilleMaterial });
    return texture;
  }

  /**
   * Botón de encendido y tecla de modo.
   */
  private buildButtons(): void {
    const front = RadioReceiver.BODY.depth / 2;
    const power = RadioReceiver.POWER;
    this.powerMaterial.color.set(power.color);
    const button = new Mesh(
      new CylinderGeometry(power.radius, power.radius, power.depth, GeometryDetail.Low),
      this.powerMaterial,
    );
    button.rotation.x = Math.PI / 2;
    button.position.set(power.x, power.y, front + power.depth / 2);
    const mode = RadioReceiver.MODE;
    this.modeMaterial.color.set(mode.color);
    const key = new Mesh(new BoxGeometry(mode.width, mode.height, mode.depth), this.modeMaterial);
    key.position.set(mode.x, mode.y, front + mode.depth / 2);
    this.group.add(button, key);
    this.handles.push({ id: RadioControl.Power, hitArea: button, glow: this.powerMaterial });
    this.handles.push({ id: RadioControl.Mode, hitArea: key, glow: this.modeMaterial });
  }

  /**
   * LED de encendido, AM, CW y señal.
   */
  private buildLeds(): void {
    const { size, depth } = RadioReceiver.LED;
    const geometry = new BoxGeometry(size, size, depth);
    const front = RadioReceiver.BODY.depth / 2 + depth / 2;
    Object.entries(RadioReceiver.LEDS).forEach(([name, led]) => {
      const material = new MeshBasicMaterial({ toneMapped: false });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(led.x, led.y, front);
      this.group.add(mesh);
      this.leds.set(name as keyof typeof RadioReceiver.LEDS, material);
    });
  }

  /**
   * Enciende o apaga un LED.
   *
   * @param name LED.
   * @param on Si está encendido.
   * @param level Brillo general.
   */
  private light(name: keyof typeof RadioReceiver.LEDS, on: boolean, level: number): void {
    const { glow, off } = RadioReceiver.LED;
    this.leds
      .get(name)
      ?.color.set(RadioReceiver.LEDS[name].color)
      .multiplyScalar(on ? Math.max(level * glow, off) : off);
  }
}
