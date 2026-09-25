import {
  Mesh,
  type CanvasTexture,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { ToolId } from '../../models/ToolId';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import { PliersTool } from './PliersTool';
import { WallTool } from './WallTool';

/**
 * Pelacables: mordazas rectas con muescas calibradas por calibre AWG (10 a 22). Cada muesca corta el aislante
 * sin tocar el cobre de ese calibre; los números van estampados junto a cada muesca. Mangos naranjas.
 */
export class WireStripper extends PliersTool {
  private static readonly SPEC = {
    spread: 0.16,
    handle: { length: 0.12, radius: 0.0088 },
    grip: 0.09,
    jaw: { length: 0.076, width: 0.017 },
    opening: 0.2,
  };
  private static readonly NOTCHES = [
    { awg: 22, y: 0.067, radius: 0.0006 },
    { awg: 20, y: 0.0605, radius: 0.00072 },
    { awg: 18, y: 0.0535, radius: 0.00088 },
    { awg: 16, y: 0.046, radius: 0.00106 },
    { awg: 14, y: 0.038, radius: 0.00128 },
    { awg: 12, y: 0.0295, radius: 0.00156 },
    { awg: 10, y: 0.0205, radius: 0.0019 },
  ];
  private static readonly JAW = { bottom: -0.008 };
  private static readonly LABEL = {
    x: -0.0105,
    bottom: 0.016,
    top: 0.072,
    width: 0.011,
    lift: 0.0038,
    pixelsPerMeter: 4000,
    font: 22,
    color: '#1b2024',
  };

  /**
   * Crea el pelacables.
   *
   * @param textures Fábrica de texturas (números estampados).
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super(ToolId.Stripper, WireStripper.SPEC, WallTool.PALETTE.orangeGrip);
  }

  /**
   * @inheritdoc
   */
  protected jaw(depth: number): BufferGeometry {
    const { length, width } = WireStripper.SPEC.jaw;
    return WallTool.SHAPES.notched(
      { width, length, bottom: WireStripper.JAW.bottom, notches: WireStripper.NOTCHES },
      depth,
    );
  }

  /**
   * Números AWG estampados junto a las muescas.
   *
   * @returns Placa con los números.
   */
  protected override details(): readonly Object3D[] {
    const { x, bottom, top, width, lift } = WireStripper.LABEL;
    const material = new MeshStandardMaterial({
      map: this.keep(this.stamp()),
      transparent: true,
      roughness: 0.5,
      metalness: 0.3,
      depthWrite: false,
    });
    const label = new Mesh(new PlaneGeometry(width, top - bottom), material);
    label.position.set(x, (top + bottom) / 2, lift);
    return [label];
  }

  /**
   * Dibuja los números de cada muesca a su altura.
   *
   * @returns Textura transparente.
   */
  private stamp(): CanvasTexture {
    const { bottom, top, width, pixelsPerMeter, font, color } = WireStripper.LABEL;
    const canvas = { width: width * pixelsPerMeter, height: (top - bottom) * pixelsPerMeter };
    return this.textures.paint(canvas.width, canvas.height, (context) => {
      context.fillStyle = color;
      context.font = `bold ${String(font)}px ${CanvasTextureFactory.SANS_FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      WireStripper.NOTCHES.forEach(({ awg, y }) => {
        context.fillText(String(awg), canvas.width / 2, (top - y) * pixelsPerMeter);
      });
    });
  }
}
