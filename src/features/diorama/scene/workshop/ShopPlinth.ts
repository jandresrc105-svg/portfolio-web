import { BoxGeometry, ExtrudeGeometry, Mesh, Shape, Vector2, type Material } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { MaterialLibrary } from '../MaterialLibrary';
import { Stall } from '../objects/Stall';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Base del segundo piso: el techo del ramen es inclinado y el piso del taller es plano, así que entre los dos
 * queda una cuña. Esta pieza la tapa con un faldón a cada lado (cuyo borde de abajo sigue la pendiente del techo)
 * y una faja al frente, para que el taller se vea apoyado sobre el puesto y no flotando.
 */
export class ShopPlinth extends SceneObject {
  private static readonly SKIRT = { thickness: 0.08, overlap: 0.03, margin: 0.05 };
  private static readonly BAND = { thickness: 0.1 };

  private readonly layout = new WorkshopLayout();

  /**
   * Crea la base.
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
    const { width } = WorkshopLayout.SHOP;
    const { thickness, margin } = ShopPlinth.SKIRT;
    [-1, 1].forEach((side) => {
      const skirt = this.add(new Mesh(this.skirt(), this.materials.lacquer));
      skirt.position.x = side * (width / 2 + margin) + (side < 0 ? thickness : 0);
    });
    this.buildBand(this.materials.lacquer);
    this.layout.place(this.root);
  }

  /**
   * Faja del frente, del techo del ramen al borde del piso del taller.
   *
   * @param material Material de la faja.
   */
  private buildBand(material: Material): void {
    const { width, depth } = WorkshopLayout.SHOP;
    const { margin, overlap } = ShopPlinth.SKIRT;
    const bottom = this.roofAt(depth / 2) - overlap;
    const size = { x: width + margin * 2, y: -bottom, z: ShopPlinth.BAND.thickness };
    this.add(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), {
      x: 0,
      y: bottom / 2,
      z: depth / 2 + size.z / 2,
    });
  }

  /**
   * Faldón lateral: un trapecio cuyo borde de abajo sigue la pendiente del techo y el de arriba es el piso.
   *
   * @returns Geometría extruida hacia -x, con el borde exterior en x = 0.
   */
  private skirt(): ExtrudeGeometry {
    const { depth } = WorkshopLayout.SHOP;
    const { thickness, overlap } = ShopPlinth.SKIRT;
    const back = -depth / 2;
    const front = depth / 2 + ShopPlinth.BAND.thickness;
    const shape = new Shape([
      new Vector2(back, this.roofAt(back) - overlap),
      new Vector2(front, this.roofAt(front) - overlap),
      new Vector2(front, 0),
      new Vector2(back, 0),
    ]);
    const geometry = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geometry.rotateY(-Math.PI / 2);
    return geometry;
  }

  /**
   * Altura del techo del ramen bajo un punto del piso del taller, en el espacio local del taller.
   *
   * @param z Profundidad local.
   * @returns Altura local (negativa: el techo queda debajo del piso).
   */
  private roofAt(z: number): number {
    const point = this.layout.world({ x: 0, y: 0, z });
    return Stall.roofTop(point.z) - point.y;
  }
}
