import { DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Cortinas de tela (noren) en la entrada del puesto, mecidas por el viento.
 */
export class Noren extends SceneObject implements Updatable {
  private static readonly GLYPHS = ['ら', 'ー', 'め', 'ん'];
  private static readonly PANEL = { width: 1.02, height: 0.72, gap: 0.04, y: 2.52, z: 1.63 };
  private static readonly CANVAS = { width: 256, height: 192, glyphSize: 132, glyphY: 118 };
  private static readonly CLOTH = '#1b2a52';
  private static readonly INK = '#f1ead9';
  private static readonly SWAY = { amplitude: 0.07, speed: 1.4, phase: 0.9 };

  private readonly panels: Group[] = [];

  /**
   * Crea las cortinas.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super();
  }

  /**
   * @inheritdoc
   */
  public update(_delta: number, elapsed: number): void {
    const { amplitude, speed, phase } = Noren.SWAY;
    this.panels.forEach((panel, index) => {
      panel.rotation.x = Math.sin(elapsed * speed + index * phase) * amplitude - amplitude;
    });
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    Noren.GLYPHS.forEach((glyph, index) => {
      this.panels.push(this.buildPanel(glyph, index));
    });
  }

  /**
   * Crea un paño colgado de su borde superior para que el balanceo pivote desde arriba.
   *
   * @param glyph Carácter impreso en el paño.
   * @param index Posición del paño.
   * @returns Pivote del paño.
   */
  private buildPanel(glyph: string, index: number): Group {
    const { width, height, gap, y, z } = Noren.PANEL;
    const geometry = new PlaneGeometry(width, height);
    geometry.translate(0, -height / 2, 0);
    const map = this.own(this.clothTexture(glyph));
    const material = new MeshStandardMaterial({ map, side: DoubleSide, roughness: 0.95 });
    const pivot = new Group();
    pivot.add(new Mesh(geometry, material));
    const x = (index - (Noren.GLYPHS.length - 1) / 2) * (width + gap);
    return this.add(pivot, { x, y, z });
  }

  /**
   * Tela índigo con el carácter en blanco.
   *
   * @param glyph Carácter.
   * @returns Textura del paño.
   */
  private clothTexture(glyph: string): ReturnType<CanvasTextureFactory['paint']> {
    const { width, height, glyphSize, glyphY } = Noren.CANVAS;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = Noren.CLOTH;
      context.fillRect(0, 0, width, height);
      context.fillStyle = Noren.INK;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `900 ${String(glyphSize)}px ${CanvasTextureFactory.JAPANESE_FONT}`;
      context.fillText(glyph, width / 2, glyphY);
    });
  }
}
