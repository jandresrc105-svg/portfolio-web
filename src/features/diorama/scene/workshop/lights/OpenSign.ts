import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type CanvasTexture,
  type Material,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { CanvasTextureFactory } from '../../CanvasTextureFactory';
import { SmoothLevel } from './SmoothLevel';
import { StrikePattern } from './StrikePattern';

/**
 * Letrero de neón "OPEN / 営業中" colgado detrás de la entrada, mirando a la calle: placa de acrílico
 * oscuro con los tubos dibujados (rojo y cian) y dos cables al techo. Al encenderse arranca con destellos,
 * como un neón real, y al apagarse se desvanece.
 */
export class OpenSign {
  private static readonly PLACE = { x: 0.82, y: 2.18, z: 0.9 };
  private static readonly SIZE = { width: 0.5, height: 0.12 };
  private static readonly BACKING = {
    margin: 0.02,
    depth: 0.012,
    color: 0x0c0d12,
    roughness: 0.3,
    metalness: 0,
  };
  private static readonly WIRE = { radius: 0.0015, top: 2.45, spread: 0.4 };
  private static readonly GLOW = { on: 2.2, off: 0.03, rate: 10 };
  private static readonly ART = {
    pixels: 720,
    border: { color: '#35e8ff', inset: 7, width: 3 },
    open: { text: 'OPEN', x: 0.3, color: '#ff3b5c', size: 58, font: CanvasTextureFactory.SANS_FONT },
    kanji: { text: '営業中', x: 0.72, color: '#35e8ff', size: 44, font: CanvasTextureFactory.JAPANESE_FONT },
    halo: [
      { width: 14, alpha: 0.12 },
      { width: 8, alpha: 0.25 },
      { width: 4, alpha: 0.9 },
    ],
    core: { color: '#fff5f8', width: 1.5 },
  };

  public readonly group = new Group();

  private readonly tubes = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  private readonly fade = new SmoothLevel(1, OpenSign.GLOW.rate);
  private readonly strike = new StrikePattern();
  private on = true;

  /**
   * Crea el letrero.
   *
   * @param textures Fábrica de texturas.
   * @param wire Material de los cables.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly wire: Material,
  ) {}

  /**
   * Construye la placa, los tubos y los cables.
   *
   * @returns Grupo y la textura de los tubos (para liberarla).
   */
  public build(): { group: Group; texture: CanvasTexture } {
    const { width, height } = OpenSign.SIZE;
    const { margin, depth, ...finish } = OpenSign.BACKING;
    const backing = new Mesh(
      new BoxGeometry(width + margin, height + margin, depth),
      new MeshStandardMaterial(finish),
    );
    backing.position.z = -depth / 2;
    const texture = this.art();
    this.tubes.map = texture;
    const tubes = new Mesh(new PlaneGeometry(width, height), this.tubes);
    tubes.position.z = depth / 2;
    this.group.add(backing, tubes);
    this.buildWires();
    const { x, y, z } = OpenSign.PLACE;
    this.group.position.set(x, y, z);
    return { group: this.group, texture };
  }

  /**
   * Enciende (con arranque) o apaga el letrero.
   *
   * @param on Si está encendido.
   */
  public setOn(on: boolean): void {
    if (on && !this.on) {
      this.strike.start();
    }
    this.on = on;
    this.fade.set(on ? 1 : 0);
  }

  /**
   * Anima el arranque y el fundido.
   *
   * @param delta Segundos desde el frame anterior.
   * @param level Brillo general.
   */
  public update(delta: number, level: number): void {
    const fade = this.fade.step(delta);
    const value = this.on ? this.strike.step(delta) : fade;
    const { on, off } = OpenSign.GLOW;
    this.tubes.color.setScalar(Math.max(value * level * on, off));
  }

  /**
   * Cables del letrero hasta el techo.
   */
  private buildWires(): void {
    const { radius, top, spread } = OpenSign.WIRE;
    const { height } = OpenSign.SIZE;
    const drop = top - OpenSign.PLACE.y - height / 2;
    [-1, 1].forEach((side) => {
      const wire = new Mesh(new CylinderGeometry(radius, radius, drop, GeometryDetail.Wire), this.wire);
      wire.position.set((side * spread) / 2, height / 2 + drop / 2, 0);
      this.group.add(wire);
    });
  }

  /**
   * Dibuja los tubos: marco cian, "OPEN" rojo y "営業中" cian, cada uno con halo y núcleo claro.
   *
   * @returns Textura transparente.
   */
  private art(): CanvasTexture {
    const { pixels, border, open, kanji } = OpenSign.ART;
    const w = Math.round(OpenSign.SIZE.width * pixels);
    const h = Math.round(OpenSign.SIZE.height * pixels);
    return this.textures.paint(w, h, (context) => {
      context.lineJoin = 'round';
      OpenSign.tube(context, border.color, (width) => {
        context.lineWidth = width;
        context.strokeRect(border.inset, border.inset, w - border.inset * 2, h - border.inset * 2);
      });
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      [open, kanji].forEach((line) => {
        OpenSign.word(context, line, { x: w * line.x, y: h / 2 });
      });
    });
  }

  /**
   * Escribe una palabra con tubos de neón.
   *
   * @param context Contexto 2D.
   * @param line Texto, color, tamaño y fuente.
   * @param line.text Texto.
   * @param line.color Color del gas.
   * @param line.size Tamaño en píxeles.
   * @param line.font Familia tipográfica.
   * @param at Centro de la palabra.
   * @param at.x Horizontal.
   * @param at.y Vertical.
   */
  private static word(
    context: CanvasRenderingContext2D,
    line: { text: string; color: string; size: number; font: string },
    at: { x: number; y: number },
  ): void {
    context.font = `700 ${String(line.size)}px ${line.font}`;
    OpenSign.tube(context, line.color, (width) => {
      context.lineWidth = width;
      context.strokeText(line.text, at.x, at.y);
    });
  }

  /**
   * Traza un tubo en capas: halos de color cada vez más finos y un núcleo casi blanco.
   *
   * @param context Contexto 2D.
   * @param color Color del gas.
   * @param stroke Trazo del tubo con un grosor dado.
   */
  private static tube(
    context: CanvasRenderingContext2D,
    color: string,
    stroke: (width: number) => void,
  ): void {
    context.strokeStyle = color;
    OpenSign.ART.halo.forEach(({ width, alpha }) => {
      context.globalAlpha = alpha;
      stroke(width);
    });
    context.globalAlpha = 1;
    context.strokeStyle = OpenSign.ART.core.color;
    stroke(OpenSign.ART.core.width);
  }
}
