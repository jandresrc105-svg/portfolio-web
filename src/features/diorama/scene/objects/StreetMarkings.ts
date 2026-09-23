import {
  CircleGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Marcas de la calle: paso de cebra con la pintura gastada y una tapa de alcantarilla metálica.
 * Pintura y metal son más lisos que el asfalto, así que brillan con los neones cuando el suelo está mojado.
 */
export class StreetMarkings extends SceneObject {
  private static readonly STRIPES = [{ x: -2.6 }, { x: -1.98 }, { x: -1.36 }, { x: -0.74 }, { x: -0.12 }];
  private static readonly STRIPE = { width: 0.36, length: 1, z: 3.9, y: 0.003, turn: 0.08 };
  private static readonly MANHOLE = { radius: 0.34, x: 2.35, y: 0.003, z: 4.3 };
  private static readonly CANVAS = { stripe: { width: 64, height: 160, wear: 140 }, manhole: 128 };
  private static readonly WEAR = { alpha: 0.3, maxRadius: 6 };
  private static readonly COVER = { roughness: 0.3, metalness: 0.85, rim: 4, inner: 0.62, grid: 12 };
  private static readonly PAINT = { color: 0x8a8880, roughness: 0.4, opacity: 0.75 };

  /**
   * Crea las marcas.
   *
   * @param textures Fábrica de texturas.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly random: SeededRandom,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildCrosswalk();
    this.buildManhole();
  }

  /**
   * Franjas del paso de cebra, en una sola geometría.
   */
  private buildCrosswalk(): void {
    const { width, length, z, y, turn } = StreetMarkings.STRIPE;
    const pieces: BufferGeometry[] = StreetMarkings.STRIPES.map(({ x }) =>
      new PlaneGeometry(width, length)
        .rotateX(-Math.PI / 2)
        .rotateY(turn)
        .translate(x, y, z),
    );
    const paint = new MeshStandardMaterial({
      ...StreetMarkings.PAINT,
      map: this.own(this.wornPaint()),
      transparent: true,
      depthWrite: false,
    });
    this.add(new Mesh(mergeGeometries(pieces), paint));
    pieces.forEach((piece) => {
      piece.dispose();
    });
  }

  /**
   * Tapa de alcantarilla metálica.
   */
  private buildManhole(): void {
    const { radius, x: manholeX, y: manholeY, z: manholeZ } = StreetMarkings.MANHOLE;
    const { roughness, metalness } = StreetMarkings.COVER;
    const cover = new MeshStandardMaterial({ map: this.own(this.manhole()), roughness, metalness });
    const disc = this.add(new Mesh(new CircleGeometry(radius, GeometryDetail.Ring), cover), {
      x: manholeX,
      y: manholeY,
      z: manholeZ,
    });
    disc.rotation.x = -Math.PI / 2;
  }

  /**
   * Pintura blanca con desgaste: huecos transparentes donde pasaron las ruedas.
   *
   * @returns Textura con transparencia.
   */
  private wornPaint(): Texture {
    const { width, height, wear } = StreetMarkings.CANVAS.stripe;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'destination-out';
      for (let hole = 0; hole < wear; hole += 1) {
        this.scuff(context, width, height);
      }
    });
  }

  /**
   * Borra un poco de pintura en un punto al azar.
   *
   * @param context Contexto 2D en modo de borrado.
   * @param width Ancho del canvas.
   * @param height Alto del canvas.
   */
  private scuff(context: CanvasRenderingContext2D, width: number, height: number): void {
    const { alpha, maxRadius } = StreetMarkings.WEAR;
    context.fillStyle = `rgba(0, 0, 0, ${String(this.random.range(alpha, 1))})`;
    context.beginPath();
    context.arc(
      this.random.range(0, width),
      this.random.range(0, height),
      this.random.range(1, maxRadius),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  /**
   * Tapa de alcantarilla: anillo exterior y cuadrícula de relieve.
   *
   * @returns Textura de la tapa.
   */
  private manhole(): Texture {
    const size = StreetMarkings.CANVAS.manhole;
    const half = size / 2;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = '#3a3c44';
      context.fillRect(0, 0, size, size);
      context.strokeStyle = '#8a8f9c';
      context.lineWidth = 3;
      context.beginPath();
      const { rim, inner, grid } = StreetMarkings.COVER;
      context.arc(half, half, half - rim, 0, Math.PI * 2);
      context.arc(half, half, half * inner, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 2;
      for (let line = -half; line < half; line += size / grid) {
        context.strokeRect(half + line, half / 2, 1, half);
        context.strokeRect(half / 2, half + line, half, 1);
      }
    });
  }
}
