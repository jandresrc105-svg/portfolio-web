import { CapsuleGeometry, CylinderGeometry, ExtrudeGeometry, Shape, type BufferGeometry } from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Geometrías de las herramientas (patrón Factory): placas de acero recortadas y extruidas con un bisel fino,
 * mordazas con muescas, mangos en píldora y ejes. Todas centradas en z para que la pieza quede plana contra
 * el tablero.
 */
export class ToolShapes {
  private static readonly BEVEL = { size: 0.0006, thickness: 0.0006 };

  /**
   * Placa extruida a partir de un contorno.
   *
   * @param points Contorno en el plano xy (antihorario), en metros.
   * @param depth Grosor.
   * @returns Geometría centrada en z.
   */
  public plate(points: readonly { x: number; y: number }[], depth: number): BufferGeometry {
    const shape = new Shape();
    points.forEach(({ x, y }, index) => {
      if (index === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
    });
    shape.closePath();
    return this.extrude(shape, depth);
  }

  /**
   * Mordaza recta a la izquierda del eje (x ≤ 0), con muescas semicirculares en el borde que cierra.
   *
   * @param jaw Medidas de la mordaza.
   * @param jaw.width Ancho.
   * @param jaw.length Largo desde el pivote.
   * @param jaw.bottom Borde inferior (bajo el pivote).
   * @param jaw.notches Muescas (altura del centro y radio), de arriba abajo.
   * @param depth Grosor.
   * @returns Geometría centrada en z.
   */
  public notched(
    jaw: { width: number; length: number; bottom: number; notches: readonly { y: number; radius: number }[] },
    depth: number,
  ): BufferGeometry {
    const { width, length, bottom } = jaw;
    const chamfer = width / 3;
    const shape = new Shape();
    shape.moveTo(0, bottom);
    shape.lineTo(-width, bottom);
    shape.lineTo(-width, length - chamfer);
    shape.lineTo(-width + chamfer, length);
    shape.lineTo(0, length);
    jaw.notches.forEach(({ y, radius }) => {
      shape.lineTo(0, y + radius);
      shape.absarc(0, y, radius, Math.PI / 2, (Math.PI * 3) / 2, false);
    });
    shape.closePath();
    return this.extrude(shape, depth);
  }

  /**
   * Píldora vertical (mangos, cuerpos redondeados).
   *
   * @param radius Radio.
   * @param length Largo total, con las tapas.
   * @returns Geometría a lo largo de y.
   */
  public pill(radius: number, length: number): BufferGeometry {
    return new CapsuleGeometry(
      radius,
      Math.max(length - radius * 2, 0),
      GeometryDetail.Thin,
      GeometryDetail.Low,
    );
  }

  /**
   * Cilindro vertical.
   *
   * @param radius Radio.
   * @param length Largo.
   * @param segments Segmentos alrededor.
   * @returns Geometría a lo largo de y.
   */
  public rod(radius: number, length: number, segments: number = GeometryDetail.Low): BufferGeometry {
    return new CylinderGeometry(radius, radius, length, segments);
  }

  /**
   * Cilindro con el eje hacia el frente (z): pernos, discos y carretes.
   *
   * @param radius Radio.
   * @param depth Largo en z.
   * @param segments Segmentos alrededor.
   * @returns Geometría a lo largo de z.
   */
  public disc(radius: number, depth: number, segments: number = GeometryDetail.Medium): BufferGeometry {
    return new CylinderGeometry(radius, radius, depth, segments).rotateX(Math.PI / 2);
  }

  /**
   * Tubo sin tapas con el eje hacia el frente (z): núcleos y bujes huecos.
   *
   * @param radius Radio.
   * @param depth Largo en z.
   * @returns Geometría a lo largo de z.
   */
  public tube(radius: number, depth: number): BufferGeometry {
    return new CylinderGeometry(radius, radius, depth, GeometryDetail.Medium, 1, true).rotateX(Math.PI / 2);
  }

  /**
   * Extruye un contorno con bisel y lo centra en z.
   *
   * @param shape Contorno.
   * @param depth Grosor.
   * @returns Geometría.
   */
  private extrude(shape: Shape, depth: number): BufferGeometry {
    const { size, thickness } = ToolShapes.BEVEL;
    return new ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: size,
      bevelThickness: thickness,
      bevelSegments: 1,
      curveSegments: GeometryDetail.Thin,
    }).translate(0, 0, -depth / 2);
  }
}
