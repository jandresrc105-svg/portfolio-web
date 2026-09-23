import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { ShopLightsControl } from '../../models/ShopLightsControl';
import type { ShopLightsState } from '../../models/ShopLightsState';
import type { WorkshopControl } from '../../models/WorkshopControl';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { ScopeKnob } from '../objects/ScopeKnob';
import { PanelToggle } from './lights/PanelToggle';
import { SmoothLevel } from './lights/SmoothLevel';

/**
 * Tablero de interruptores industrial en la pared derecha del local: gabinete de acero gris, franja de
 * peligro, una palanca con su LED piloto por circuito (techo, banco, letrero, plasma) y el dimmer giratorio
 * del techo con su escala. Se construye con la cara en z = 0 mirando a +z y se monta girado hacia el
 * interior del local.
 */
export class SwitchPanel {
  private static readonly MOUNT = { x: 1.17, y: 1.4, z: 0.75, turn: -Math.PI / 2 };
  private static readonly BOX = { width: 0.36, height: 0.62, depth: 0.07, lift: 0.0006 };
  private static readonly STEEL = { color: 0x5b6570, roughness: 0.55, metalness: 0.55, envMapIntensity: 0.4 };
  private static readonly FACE_FINISH = { roughness: 0.6, metalness: 0.2, envMapIntensity: 0.3 };
  private static readonly ROWS = [
    { control: ShopLightsControl.Ceiling, label: 'TECHO', y: 0.17 },
    { control: ShopLightsControl.Bench, label: 'BANCO', y: 0.085 },
    { control: ShopLightsControl.Sign, label: 'OPEN', y: 0 },
    { control: ShopLightsControl.Plasma, label: 'PLASMA', y: -0.085 },
  ];
  private static readonly KNOB = { x: -0.07, y: -0.2, radius: 0.03, depth: 0.022, rate: 14 };
  private static readonly ART = {
    pixels: 700,
    background: '#262b31',
    stripe: { height: 0.035, band: 14, dark: '#15171a', light: '#f2c230' },
    title: { text: '照明 · LUCES', y: 0.26, size: 22, color: '#eef1f4' },
    label: { x: 0.03, size: 19, color: '#dfe4ea' },
    state: { x: -0.155, size: 10, color: '#9aa3ad', gap: 0.03 },
    dial: { ticks: 11, inner: 0.036, outer: 0.044, text: 0.056, size: 10, color: '#cfd5dc', sweep: 0.75 },
    dimmer: { x: 0.08, text: 'DIMMER' },
  };

  public readonly group = new Group();

  private readonly toggles = new Map<ShopLightsControl, PanelToggle>();
  private readonly knob: ScopeKnob;
  private readonly dimmer = new SmoothLevel(1, SwitchPanel.KNOB.rate);

  /**
   * Crea el tablero.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   */
  public constructor(
    materials: MaterialLibrary,
    private readonly textures: CanvasTextureFactory,
  ) {
    const { radius, depth } = SwitchPanel.KNOB;
    this.knob = new ScopeKnob(radius, depth, { body: materials.cable, cap: materials.metal }, true);
    SwitchPanel.ROWS.forEach(({ control, y }) => {
      this.toggles.set(control, new PanelToggle(y, { plate: materials.metal, bezel: materials.darkMetal }));
    });
  }

  /**
   * Construye el gabinete, la cara serigrafiada, las palancas y el dimmer.
   *
   * @returns Grupo montado en la pared, y la textura de la cara (para liberarla).
   */
  public build(): { group: Group; texture: CanvasTexture } {
    const { width, height, depth, lift } = SwitchPanel.BOX;
    const box = new Mesh(new BoxGeometry(width, height, depth), new MeshStandardMaterial(SwitchPanel.STEEL));
    box.position.z = -depth / 2;
    const texture = this.face();
    const face = new Mesh(
      new PlaneGeometry(width, height),
      new MeshStandardMaterial({ ...SwitchPanel.FACE_FINISH, map: texture }),
    );
    face.position.z = lift;
    this.group.add(box, face);
    this.toggles.forEach((toggle) => this.group.add(toggle.build()));
    this.knob.group.position.set(SwitchPanel.KNOB.x, SwitchPanel.KNOB.y, 0);
    this.group.add(this.knob.group);
    const { x, y, z, turn } = SwitchPanel.MOUNT;
    this.group.position.set(x, y, z);
    this.group.rotation.y = turn;
    return { group: this.group, texture };
  }

  /**
   * Controles del tablero que reciben el puntero.
   *
   * @returns Palancas y dimmer.
   */
  public controls(): WorkshopControl[] {
    const levers = [...this.toggles].map(([id, toggle]) => ({ id, hitArea: toggle.hitArea }));
    return [...levers, { id: ShopLightsControl.Dimmer, hitArea: this.knob.hitArea }];
  }

  /**
   * Lleva las palancas y el dimmer al estado.
   *
   * @param state Estado de las luces.
   */
  public show(state: ShopLightsState): void {
    this.toggles.get(ShopLightsControl.Ceiling)?.setOn(state.ceiling);
    this.toggles.get(ShopLightsControl.Bench)?.setOn(state.bench);
    this.toggles.get(ShopLightsControl.Sign)?.setOn(state.sign);
    this.toggles.get(ShopLightsControl.Plasma)?.setOn(state.plasma);
    this.dimmer.set(state.dimmer);
  }

  /**
   * Anima las palancas, los LED y la perilla.
   *
   * @param delta Segundos desde el frame anterior.
   * @param level Brillo general.
   */
  public update(delta: number, level: number): void {
    this.toggles.forEach((toggle) => {
      toggle.update(delta, level);
    });
    this.knob.setFraction(this.dimmer.step(delta));
  }

  /**
   * Resalta el control señalado.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.toggles.forEach((toggle, control) => {
      toggle.highlight(control === id);
    });
    this.knob.setHighlight(id === ShopLightsControl.Dimmer);
  }

  /**
   * Serigrafía de la cara: franja de peligro, título, nombres de los circuitos y escala del dimmer.
   *
   * @returns Textura.
   */
  private face(): CanvasTexture {
    const { width, height } = SwitchPanel.BOX;
    const { pixels, background } = SwitchPanel.ART;
    const w = Math.round(width * pixels);
    const h = Math.round(height * pixels);
    return this.textures.paint(w, h, (context) => {
      context.fillStyle = background;
      context.fillRect(0, 0, w, h);
      SwitchPanel.stripe(context, w);
      context.textBaseline = 'middle';
      SwitchPanel.labels(context, w, h);
      SwitchPanel.dial(context, w, h);
    });
  }

  /**
   * Franja amarilla y negra en el borde superior.
   *
   * @param context Contexto 2D.
   * @param w Ancho del canvas.
   */
  private static stripe(context: CanvasRenderingContext2D, w: number): void {
    const { height, band, dark, light } = SwitchPanel.ART.stripe;
    const size = height * SwitchPanel.ART.pixels;
    context.fillStyle = dark;
    context.fillRect(0, 0, w, size);
    context.fillStyle = light;
    for (let x = -size; x < w; x += band * 2) {
      context.beginPath();
      context.moveTo(x, size);
      context.lineTo(x + band, size);
      context.lineTo(x + band + size, 0);
      context.lineTo(x + size, 0);
      context.fill();
    }
  }

  /**
   * Título, nombre de cada circuito y las marcas ON/OFF de cada palanca.
   *
   * @param context Contexto 2D.
   * @param w Ancho del canvas.
   * @param h Alto del canvas.
   */
  private static labels(context: CanvasRenderingContext2D, w: number, h: number): void {
    const { title, label, state } = SwitchPanel.ART;
    const toX = (x: number): number => w / 2 + x * SwitchPanel.ART.pixels;
    const toY = (y: number): number => h / 2 - y * SwitchPanel.ART.pixels;
    context.textAlign = 'center';
    SwitchPanel.text(context, title, { x: w / 2, y: toY(title.y) });
    SwitchPanel.ROWS.forEach((row) => {
      SwitchPanel.text(context, { ...label, text: row.label }, { x: toX(label.x), y: toY(row.y) });
      SwitchPanel.text(context, { ...state, text: 'ON' }, { x: toX(state.x), y: toY(row.y + state.gap) });
      SwitchPanel.text(context, { ...state, text: 'OFF' }, { x: toX(state.x), y: toY(row.y - state.gap) });
    });
    const { dimmer } = SwitchPanel.ART;
    const knob = SwitchPanel.KNOB;
    SwitchPanel.text(context, { ...label, text: dimmer.text }, { x: toX(dimmer.x), y: toY(knob.y) });
  }

  /**
   * Escala del dimmer: marcas de 0 a 100 % alrededor de la perilla.
   *
   * @param context Contexto 2D.
   * @param w Ancho del canvas.
   * @param h Alto del canvas.
   */
  private static dial(context: CanvasRenderingContext2D, w: number, h: number): void {
    const { ticks, inner, outer, color, sweep } = SwitchPanel.ART.dial;
    const { pixels } = SwitchPanel.ART;
    const center = { x: w / 2 + SwitchPanel.KNOB.x * pixels, y: h / 2 - SwitchPanel.KNOB.y * pixels };
    const arc = sweep * Math.PI * 2;
    context.strokeStyle = color;
    context.lineWidth = 2;
    for (let tick = 0; tick < ticks; tick += 1) {
      const angle = -Math.PI / 2 - arc / 2 + (arc * tick) / (ticks - 1);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      context.beginPath();
      context.moveTo(center.x + cos * inner * pixels, center.y + sin * inner * pixels);
      context.lineTo(center.x + cos * outer * pixels, center.y + sin * outer * pixels);
      context.stroke();
    }
    SwitchPanel.dialEnds(context, center, arc);
  }

  /**
   * Números de los extremos de la escala del dimmer.
   *
   * @param context Contexto 2D.
   * @param center Centro de la perilla en el canvas.
   * @param center.x Horizontal.
   * @param center.y Vertical.
   * @param arc Recorrido de la perilla en radianes.
   */
  private static dialEnds(
    context: CanvasRenderingContext2D,
    center: { x: number; y: number },
    arc: number,
  ): void {
    const { text, size, color } = SwitchPanel.ART.dial;
    const radius = text * SwitchPanel.ART.pixels;
    [
      { label: '0', angle: -Math.PI / 2 - arc / 2 },
      { label: '100', angle: -Math.PI / 2 + arc / 2 },
    ].forEach(({ label, angle }) => {
      const point = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
      SwitchPanel.text(context, { text: label, size, color }, point);
    });
  }

  /**
   * Escribe un texto centrado.
   *
   * @param context Contexto 2D.
   * @param style Texto, tamaño y color.
   * @param style.text Texto.
   * @param style.size Tamaño en píxeles.
   * @param style.color Color.
   * @param at Punto del canvas.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   */
  private static text(
    context: CanvasRenderingContext2D,
    style: { text: string; size: number; color: string },
    at: { x: number; y: number },
  ): void {
    context.font = `700 ${String(style.size)}px ${CanvasTextureFactory.SANS_FONT}`;
    context.fillStyle = style.color;
    context.fillText(style.text, at.x, at.y);
  }
}
