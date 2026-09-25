import { BoxGeometry, CylinderGeometry, Mesh, MeshStandardMaterial, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Escalera exterior de acero pintado, como las de los edificios pequeños de Tokio: sube por el costado derecho
 * del ramen, de atrás hacia adelante, hasta un descanso frente a la puerta del taller. Todas las piezas
 * (descanso, zancas, peldaños, pasamanos y sus parales) van en una sola geometría: un solo draw call.
 */
export class ShopStairs extends SceneObject {
  private static readonly FINISH = { color: 0x3d5a55, roughness: 0.55, metalness: 0.55 };
  private static readonly LANDING = { inner: 2.3, outer: 3.3, depth: 0.8, thickness: 0.06 };
  private static readonly FLIGHT = { x: 2.95, width: 0.66, steps: 14, run: 0.2 };
  private static readonly TREAD = { thickness: 0.03, overlap: 0.03 };
  private static readonly STRINGER = { width: 0.04, height: 0.16 };
  private static readonly RAIL = { radius: 0.018, height: 0.85, posts: 4, post: 0.014 };

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const geometry = mergeGeometries([
      this.landing(),
      ...this.treads(),
      ...this.stringers(),
      ...this.railing(),
    ]);
    this.add(new Mesh(geometry, new MeshStandardMaterial(ShopStairs.FINISH)));
    new WorkshopLayout().place(this.root);
  }

  /**
   * Descanso frente a la puerta, apenas bajo el nivel del piso del taller.
   *
   * @returns Geometría del descanso.
   */
  private landing(): BufferGeometry {
    const { inner, outer, depth, thickness } = ShopStairs.LANDING;
    return new BoxGeometry(outer - inner, thickness, depth).translate(
      (inner + outer) / 2,
      -thickness / 2,
      WorkshopLayout.DOOR.z,
    );
  }

  /**
   * Peldaños: bajan desde el borde de atrás del descanso hasta la acera.
   *
   * @returns Geometrías de los peldaños.
   */
  private treads(): BufferGeometry[] {
    const { x, width, steps, run } = ShopStairs.FLIGHT;
    const { thickness, overlap } = ShopStairs.TREAD;
    const rise = ShopStairs.rise();
    return Array.from({ length: steps }, (_, index) =>
      new BoxGeometry(width, thickness, run + overlap).translate(
        x,
        -rise * (index + 1) - thickness / 2,
        ShopStairs.top() - run * (index + 0.5),
      ),
    );
  }

  /**
   * Zancas inclinadas a cada lado de los peldaños.
   *
   * @returns Geometrías de las zancas.
   */
  private stringers(): BufferGeometry[] {
    const { x, width } = ShopStairs.FLIGHT;
    const { width: side, height } = ShopStairs.STRINGER;
    return [-1, 1].map((edge) =>
      this.slope(new BoxGeometry(side, height, ShopStairs.span()), x + (edge * (width + side)) / 2, 0),
    );
  }

  /**
   * Pasamanos del lado de afuera, con sus parales, más la baranda del descanso.
   *
   * @returns Geometrías de la baranda.
   */
  private railing(): BufferGeometry[] {
    const { x, width } = ShopStairs.FLIGHT;
    const { radius, height, posts, post } = ShopStairs.RAIL;
    const outer = x + width / 2;
    const rail = new CylinderGeometry(radius, radius, ShopStairs.span(), GeometryDetail.Low).rotateX(
      Math.PI / 2,
    );
    const pieces = [this.slope(rail, outer, height)];
    for (let index = 0; index <= posts; index += 1) {
      const t = index / posts;
      const z = ShopStairs.top() - t * ShopStairs.run();
      const base = -t * ShopStairs.drop();
      pieces.push(
        new CylinderGeometry(post, post, height, GeometryDetail.Low).translate(outer, base + height / 2, z),
      );
    }
    return [...pieces, ...this.landingRail(radius, height)];
  }

  /**
   * Baranda del borde de afuera del descanso.
   *
   * @param radius Radio del tubo.
   * @param height Altura de la baranda.
   * @returns Geometrías de la baranda.
   */
  private landingRail(radius: number, height: number): BufferGeometry[] {
    const { outer, depth } = ShopStairs.LANDING;
    const z = WorkshopLayout.DOOR.z;
    const rail = new CylinderGeometry(radius, radius, depth, GeometryDetail.Low).rotateX(Math.PI / 2);
    const post = new CylinderGeometry(radius, radius, height, GeometryDetail.Low);
    return [
      rail.translate(outer, height, z),
      post.clone().translate(outer, height / 2, z + depth / 2),
      post.translate(outer, height / 2, z - depth / 2),
    ];
  }

  /**
   * Inclina una pieza a lo largo del tramo y la centra en él.
   *
   * @param geometry Pieza alineada con z.
   * @param x Posición horizontal.
   * @param lift Altura sobre la línea de los peldaños.
   * @returns La misma geometría, inclinada y colocada.
   */
  private slope(geometry: BufferGeometry, x: number, lift: number): BufferGeometry {
    const angle = Math.atan2(ShopStairs.drop(), ShopStairs.run());
    return geometry
      .rotateX(-angle)
      .translate(x, -ShopStairs.drop() / 2 + lift, ShopStairs.top() - ShopStairs.run() / 2);
  }

  /**
   * Borde de atrás del descanso, donde empieza el tramo.
   *
   * @returns Profundidad local.
   */
  private static top(): number {
    return WorkshopLayout.DOOR.z - ShopStairs.LANDING.depth / 2;
  }

  /**
   * Altura de cada escalón: el tramo baja del piso del taller a la acera en partes iguales.
   *
   * @returns Contrahuella.
   */
  private static rise(): number {
    return -WorkshopLayout.GROUND / (ShopStairs.FLIGHT.steps + 1);
  }

  /**
   * Desnivel del tramo, hasta la huella del último peldaño.
   *
   * @returns Altura que baja el tramo.
   */
  private static drop(): number {
    return ShopStairs.rise() * ShopStairs.FLIGHT.steps;
  }

  /**
   * Avance horizontal del tramo.
   *
   * @returns Largo en planta.
   */
  private static run(): number {
    return ShopStairs.FLIGHT.run * ShopStairs.FLIGHT.steps;
  }

  /**
   * Largo inclinado del tramo.
   *
   * @returns Largo de las zancas y el pasamanos.
   */
  private static span(): number {
    return Math.hypot(ShopStairs.drop(), ShopStairs.run());
  }
}
