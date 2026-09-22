import { BoxGeometry, CylinderGeometry, Mesh, type Material, type Vector3Like } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Estructura del puesto de ramen: postes, techo inclinado, paredes, barra y taburetes.
 */
export class Stall extends SceneObject {
  private static readonly POST = { size: 0.14, height: 2.75 };
  private static readonly POST_X = 2.2;
  private static readonly POST_ROWS = [{ z: 1.3 }, { z: -1.65 }];
  private static readonly ROOF = { width: 5, height: 0.12, depth: 3.7, y: 2.92, z: -0.2, tilt: 0.13 };
  private static readonly FASCIA = { width: 5.05, height: 0.3, depth: 0.08, y: 2.66, z: 1.58 };
  private static readonly BACK_WALL = { width: 4.4, height: 2.75, depth: 0.12, z: -1.68 };
  private static readonly SIDE_WALL = { width: 0.1, height: 1.15, depth: 2.9, z: -0.25 };
  private static readonly COUNTER = { width: 4.2, height: 1.02, depth: 0.5, z: 0.72 };
  private static readonly COUNTER_TOP = { width: 4.5, height: 0.07, depth: 0.85, y: 1.055, z: 0.78 };
  private static readonly KITCHEN = { width: 4.2, height: 0.92, depth: 0.6, z: -1.25 };
  private static readonly STOOL = { radius: 0.2, seat: 0.07, leg: 0.04, height: 0.72, z: 1.55 };
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
   * Postes, techo y faja frontal lacada.
   */
  private buildFrame(): void {
    const { size, height } = Stall.POST;
    Stall.POST_ROWS.forEach(({ z }) => {
      [-Stall.POST_X, Stall.POST_X].forEach((x) => {
        this.box({ width: size, height, depth: size }, { x, y: height / 2, z }, this.materials.woodDark);
      });
    });
    const { width, height: roofHeight, depth, y, z, tilt } = Stall.ROOF;
    this.box({ width, height: roofHeight, depth }, { x: 0, y, z }, this.materials.roof).rotation.x = tilt;
    const fascia = Stall.FASCIA;
    this.box(fascia, { x: 0, y: fascia.y, z: fascia.z }, this.materials.lacquer);
  }

  /**
   * Pared trasera y paredes laterales bajas.
   */
  private buildWalls(): void {
    const back = Stall.BACK_WALL;
    this.box(back, { x: 0, y: back.height / 2, z: back.z }, this.materials.woodDark);
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
}
