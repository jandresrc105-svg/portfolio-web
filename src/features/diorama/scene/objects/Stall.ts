import { BoxGeometry, CylinderGeometry, Mesh, type Material, type Vector3Like } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Estructura del puesto de ramen: postes, techo inclinado apoyado en vigas, paredes, barra y taburetes.
 * Los postes y la pared trasera llegan justo hasta la cara inferior del techo según su pendiente, para que
 * el techo no flote ni quede atravesado.
 */
export class Stall extends SceneObject {
  private static readonly POST = { size: 0.14 };
  private static readonly POST_X = 2.2;
  private static readonly POST_ROWS = [{ z: 1.3 }, { z: -1.65 }];
  private static readonly ROOF = { width: 5, height: 0.12, depth: 3.7, y: 2.92, z: -0.2, tilt: 0.13 };
  private static readonly FASCIA = { width: 5.05, height: 0.3, depth: 0.08, y: 2.66, z: 1.58 };
  private static readonly BEAM = { size: 0.12 };
  private static readonly BACK_WALL = { width: 4.4, depth: 0.12, z: -1.68 };
  private static readonly SIDE_WALL = { width: 0.1, height: 1.15, depth: 2.9, z: -0.25 };
  private static readonly COUNTER = { width: 4.2, height: 1.02, depth: 0.5, z: 0.72 };
  private static readonly COUNTER_TOP = { width: 4.5, height: 0.07, depth: 0.85, y: 1.055, z: 0.78 };
  private static readonly KITCHEN = { width: 4.2, height: 0.92, depth: 0.6, z: -1.25 };
  private static readonly STOOL = { radius: 0.2, seat: 0.07, leg: 0.04, height: 0.72, z: 1.5 };
  private static readonly STOOLS = [{ x: -1.4 }, { x: -0.47 }, { x: 0.47 }, { x: 1.4 }];

  /**
   * Crea la estructura.
   *
   * @param materials Materiales compartidos.
   */
  public constructor(private readonly materials: MaterialLibrary) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildFrame();
    this.buildWalls();
    this.buildCounter();
    Stall.STOOLS.forEach(({ x }) => {
      this.buildStool(x);
    });
  }

  /**
   * Postes hasta el techo, vigas que lo sostienen, techo y faja frontal lacada.
   */
  private buildFrame(): void {
    const { size } = Stall.POST;
    Stall.POST_ROWS.forEach(({ z }) => {
      const height = Stall.roofUnderside(z) - Stall.BEAM.size;
      [-Stall.POST_X, Stall.POST_X].forEach((x) => {
        this.box({ width: size, height, depth: size }, { x, y: height / 2, z }, this.materials.woodDark);
      });
    });
    this.buildBeams();
    const { width, height: roofHeight, depth, y, z, tilt } = Stall.ROOF;
    this.box({ width, height: roofHeight, depth }, { x: 0, y, z }, this.materials.roof).rotation.x = tilt;
    const fascia = Stall.FASCIA;
    this.box(fascia, { x: 0, y: fascia.y, z: fascia.z }, this.materials.lacquer);
  }

  /**
   * Vigas bajo el techo: una sobre cada fila de postes y una a cada lado siguiendo la pendiente.
   */
  private buildBeams(): void {
    const beam = Stall.BEAM.size;
    const span = Stall.POST_X * 2 + Stall.POST.size;
    Stall.POST_ROWS.forEach(({ z }) => {
      const y = Stall.roofUnderside(z) - beam / 2;
      this.box({ width: span, height: beam, depth: beam }, { x: 0, y, z }, this.materials.woodDark);
    });
    this.buildSideBeams();
  }

  /**
   * Vigas laterales inclinadas, de la fila de postes delantera a la trasera.
   */
  private buildSideBeams(): void {
    const [front, back] = Stall.POST_ROWS;
    if (!front || !back) {
      return;
    }
    const beam = Stall.BEAM.size;
    const middle = (front.z + back.z) / 2;
    const size = { width: beam, height: beam, depth: (front.z - back.z) / Math.cos(Stall.ROOF.tilt) + beam };
    const y = Stall.roofUnderside(middle) - beam / 2;
    [-Stall.POST_X, Stall.POST_X].forEach((x) => {
      this.box(size, { x, y, z: middle }, this.materials.woodDark).rotation.x = Stall.ROOF.tilt;
    });
  }

  /**
   * Pared trasera y paredes laterales bajas.
   */
  private buildWalls(): void {
    const back = Stall.BACK_WALL;
    const height = Stall.roofUnderside(back.z);
    this.box({ ...back, height }, { x: 0, y: height / 2, z: back.z }, this.materials.woodDark);
    const side = Stall.SIDE_WALL;
    [-Stall.POST_X, Stall.POST_X].forEach((x) => {
      this.box(side, { x, y: side.height / 2, z: side.z }, this.materials.woodDark);
    });
  }

  /**
   * Barra de clientes y mesón de cocina.
   */
  private buildCounter(): void {
    const counter = Stall.COUNTER;
    this.box(counter, { x: 0, y: counter.height / 2, z: counter.z }, this.materials.woodDark);
    const top = Stall.COUNTER_TOP;
    this.box(top, { x: 0, y: top.y, z: top.z }, this.materials.woodLight);
    const kitchen = Stall.KITCHEN;
    this.box(kitchen, { x: 0, y: kitchen.height / 2, z: kitchen.z }, this.materials.metal);
  }

  /**
   * Taburete con asiento lacado.
   *
   * @param x Posición horizontal.
   */
  private buildStool(x: number): void {
    const { radius, seat, leg, height, z } = Stall.STOOL;
    this.add(new Mesh(new CylinderGeometry(leg, leg, height), this.materials.darkMetal), {
      x,
      y: height / 2,
      z,
    });
    this.add(new Mesh(new CylinderGeometry(radius, radius, seat), this.materials.lacquer), {
      x,
      y: height,
      z,
    });
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param size.width Ancho.
   * @param size.height Alto.
   * @param size.depth Profundidad.
   * @param position Posición del centro.
   * @param material Material.
   * @returns Malla creada.
   */
  private box(
    size: { width: number; height: number; depth: number },
    position: Vector3Like,
    material: Material,
  ): Mesh {
    return this.add(new Mesh(new BoxGeometry(size.width, size.height, size.depth), material), position);
  }

  /**
   * Altura de la cara inferior del techo inclinado en una profundidad dada.
   *
   * @param z Profundidad (coordenada z).
   * @returns Altura de la cara inferior.
   */
  private static roofUnderside(z: number): number {
    const { height, y, z: center, tilt } = Stall.ROOF;
    return y - height / (2 * Math.cos(tilt)) - (z - center) * Math.tan(tilt);
  }
}
