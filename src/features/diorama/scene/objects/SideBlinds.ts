import { DoubleSide, Mesh, MeshStandardMaterial, PlaneGeometry, type Texture } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Persianas de bambú (sudare) medio enrolladas en los costados abiertos del puesto. Tapan la pared del fondo
 * vista de lado (se leía como un recuadro de luz plano) y dejan pasar un poco de la luz cálida entre las varillas.
 */
export class SideBlinds extends SceneObject implements Updatable {
  private static readonly SIDES = [{ x: -2.26 }, { x: 2.26 }];
  private static readonly BLIND = { width: 2.95, height: 0.78, top: 2.64, z: -0.18 };
  private static readonly CANVAS = {
    width: 256,
    height: 128,
    slats: 40,
    fill: 0.72,
    cord: 2,
    cords: [{ x: 0.2 }, { x: 0.8 }],
  };
  private static readonly SWAY = { amplitude: 0.025, speed: 0.8 };
  private static readonly FINISH = { roughness: 0.85, envMapIntensity: 0.2, alphaTest: 0.05 };

  private readonly panels: Mesh[] = [];

  /**
   * Crea las persianas.
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
    const { amplitude, speed } = SideBlinds.SWAY;
    this.panels.forEach((panel, index) => {
      panel.rotation.x = Math.sin(elapsed * speed + index) * amplitude;
    });
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { width, height, top, z } = SideBlinds.BLIND;
    const material = new MeshStandardMaterial({
      ...SideBlinds.FINISH,
      map: this.own(this.slats()),
      transparent: true,
      side: DoubleSide,
    });
    const geometry = new PlaneGeometry(width, height).translate(0, -height / 2, 0);
    SideBlinds.SIDES.forEach(({ x }) => {
      const panel = this.add(new Mesh(geometry.clone(), material), { x, y: top, z });
      panel.rotation.order = 'YXZ';
      panel.rotation.y = Math.PI / 2;
      this.panels.push(panel);
    });
    geometry.dispose();
  }

  /**
   * Varillas horizontales de bambú con huecos entre ellas y dos cordones de amarre.
   *
   * @returns Textura con transparencia.
   */
  private slats(): Texture {
    const { width, height, slats, fill, cord, cords } = SideBlinds.CANVAS;
    const pitch = height / slats;
    return this.textures.paint(width, height, (context) => {
      for (let slat = 0; slat < slats; slat += 1) {
        context.fillStyle = slat % 2 === 0 ? '#b98b55' : '#a47a47';
        context.fillRect(0, slat * pitch, width, pitch * fill);
      }
      context.fillStyle = '#3b2616';
      cords.forEach(({ x }) => {
        context.fillRect(width * x, 0, cord, height);
      });
    });
  }
}
