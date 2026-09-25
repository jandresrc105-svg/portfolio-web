import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Paneles solares en el techo del taller: dos filas de módulos inclinados hacia la calle sobre rieles de
 * aluminio. De noche no generan, pero sus celdas reflejan los neones. Los marcos, rieles y parales van en una
 * geometría y las celdas en otra: dos draw calls para todo el techo.
 */
export class SolarArray extends SceneObject {
  private static readonly ROOF_TOP = 0.07;
  private static readonly COLUMNS = [{ x: -1.53 }, { x: -0.51 }, { x: 0.51 }, { x: 1.53 }];
  private static readonly ROWS = [{ z: -0.62 }, { z: 0.2 }];
  private static readonly MODULE = { width: 0.98, depth: 0.62, thickness: 0.035, tilt: 0.35, lift: 0.16 };
  private static readonly CELLS = { inset: 0.02, above: 0.002 };
  private static readonly RAIL = { size: 0.035, overhang: 0.08 };
  private static readonly POSTS = [{ x: -1.9 }, { x: 0 }, { x: 1.9 }];
  private static readonly POST = { radius: 0.016 };
  private static readonly FINISH = { roughness: 0.22, metalness: 0.35, envMapIntensity: 1.2 };
  private static readonly ART = { width: 256, height: 160, columns: 10, rows: 6, gap: 2, busbars: 3 };
  private static readonly COLORS = { back: '#b8c2d0', cell: '#0f1f47', line: '#6d7fa3' };

  /**
   * Crea los paneles.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly textures: CanvasTextureFactory,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const frames: BufferGeometry[] = [];
    const cells: BufferGeometry[] = [];
    SolarArray.ROWS.forEach(({ z }) => {
      SolarArray.COLUMNS.forEach(({ x }) => {
        frames.push(this.tilted(this.frame(), x, z));
        cells.push(this.tilted(this.cellFace(), x, z));
      });
      frames.push(...this.rack(z));
    });
    this.add(new Mesh(mergeGeometries(frames), this.materials.metal));
    const glass = new MeshStandardMaterial({ ...SolarArray.FINISH, map: this.own(this.cellArt()) });
    this.add(new Mesh(mergeGeometries(cells), glass));
    new WorkshopLayout().place(this.root);
  }

  /**
   * Marco del módulo, centrado en el origen.
   *
   * @returns Geometría del marco.
   */
  private frame(): BufferGeometry {
    const { width, depth, thickness } = SolarArray.MODULE;
    return new BoxGeometry(width, thickness, depth);
  }

  /**
   * Cara de celdas sobre el marco, mirando hacia arriba.
   *
   * @returns Geometría de las celdas.
   */
  private cellFace(): BufferGeometry {
    const { width, depth, thickness } = SolarArray.MODULE;
    const { inset, above } = SolarArray.CELLS;
    return new PlaneGeometry(width - inset * 2, depth - inset * 2)
      .rotateX(-Math.PI / 2)
      .translate(0, thickness / 2 + above, 0);
  }

  /**
   * Inclina una pieza hacia la calle (el borde de adelante más bajo) y la sube a su lugar en el techo.
   *
   * @param geometry Pieza centrada en el origen.
   * @param x Columna.
   * @param z Fila.
   * @returns La misma geometría, colocada.
   */
  private tilted(geometry: BufferGeometry, x: number, z: number): BufferGeometry {
    const { depth, tilt, lift } = SolarArray.MODULE;
    const center = SolarArray.base() + lift + (depth / 2) * Math.sin(tilt);
    return geometry.rotateX(tilt).translate(x, center, z);
  }

  /**
   * Rieles de una fila (uno bajo el borde de adelante y otro bajo el de atrás) con sus parales al techo.
   *
   * @param z Centro de la fila.
   * @returns Geometrías del bastidor.
   */
  private rack(z: number): BufferGeometry[] {
    const { depth, tilt, lift } = SolarArray.MODULE;
    const { size, overhang } = SolarArray.RAIL;
    const span = SolarArray.span() + overhang;
    const half = (depth / 2) * Math.cos(tilt);
    const edges = [
      { z: z + half, y: SolarArray.base() + lift },
      { z: z - half, y: SolarArray.base() + lift + depth * Math.sin(tilt) },
    ];
    return edges.flatMap((edge) => [
      new BoxGeometry(span, size, size).translate(0, edge.y - size / 2, edge.z),
      ...SolarArray.POSTS.map(({ x }) => this.post(x, edge.z, edge.y - size)),
    ]);
  }

  /**
   * Paral del techo al riel.
   *
   * @param x Posición horizontal.
   * @param z Profundidad.
   * @param top Altura del riel.
   * @returns Geometría del paral.
   */
  private post(x: number, z: number, top: number): BufferGeometry {
    const height = top - SolarArray.base();
    const { radius } = SolarArray.POST;
    return new CylinderGeometry(radius, radius, height, GeometryDetail.Low).translate(
      x,
      SolarArray.base() + height / 2,
      z,
    );
  }

  /**
   * Celdas azul oscuro en cuadrícula, con las cintas de soldadura plateadas.
   *
   * @returns Textura de las celdas.
   */
  private cellArt(): Texture {
    const { width, height, columns, rows, gap, busbars } = SolarArray.ART;
    const { back, cell, line } = SolarArray.COLORS;
    const w = width / columns;
    const h = height / rows;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = back;
      context.fillRect(0, 0, width, height);
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          context.fillStyle = cell;
          context.fillRect(column * w + gap / 2, row * h + gap / 2, w - gap, h - gap);
        }
      }
      context.fillStyle = line;
      for (let bar = 1; bar <= busbars; bar += 1) {
        context.fillRect(0, (bar * height) / (busbars + 1), width, 1);
      }
    });
  }

  /**
   * Altura del techo del taller, donde se apoyan los parales.
   *
   * @returns Altura local.
   */
  private static base(): number {
    return WorkshopLayout.SHOP.height + SolarArray.ROOF_TOP;
  }

  /**
   * Ancho de una fila de módulos.
   *
   * @returns Distancia entre los bordes de los módulos de los extremos.
   */
  private static span(): number {
    const xs = SolarArray.COLUMNS.map(({ x }) => x);
    return Math.max(...xs) - Math.min(...xs) + SolarArray.MODULE.width;
  }
}
