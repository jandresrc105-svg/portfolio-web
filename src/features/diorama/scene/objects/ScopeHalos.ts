import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  type Vector3Like,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Anillos de luz de las perillas interactivas de un equipo, unidos en una sola malla transparente: cada anillo
 * lleva su color y su opacidad por vértice (tenue o encendido al señalar su perilla), así todos cuestan un solo
 * dibujo. Se encienden y apagan todos juntos con el equipo.
 */
export class ScopeHalos {
  private static readonly HALO = { radius: 1.35, tube: 0.07, color: 0x3fd8ff, dim: 0.35, lit: 1.6 };
  private static readonly RGBA = 4;

  public readonly mesh = new Mesh(
    new BufferGeometry(),
    new MeshBasicMaterial({ vertexColors: true, transparent: true }),
  );

  private readonly rings: { radius: number; position: Vector3Like }[] = [];
  private readonly ranges: { start: number; count: number }[] = [];
  private readonly tint = new Color();

  /**
   * Agrega el anillo de una perilla.
   *
   * @param radius Radio de la perilla.
   * @param position Centro de la base de la perilla, en el espacio de la malla.
   * @returns Número del anillo.
   */
  public add(radius: number, position: Vector3Like): number {
    this.rings.push({ radius, position });
    return this.rings.length - 1;
  }

  /**
   * Arma la malla con los anillos agregados, todos tenues.
   *
   * @returns La malla.
   */
  public build(): Mesh {
    const { radius: size, tube } = ScopeHalos.HALO;
    const parts = this.rings.map(({ radius, position }) => {
      const ring = new TorusGeometry(radius * size, radius * tube, GeometryDetail.Thin, GeometryDetail.Curve);
      ring.translate(position.x, position.y, position.z);
      this.ranges.push({ start: this.count(), count: ring.getAttribute('position').count });
      return ring;
    });
    this.adopt(mergeGeometries(parts));
    parts.forEach((part) => {
      part.dispose();
    });
    this.ranges.forEach((_, index) => {
      this.setLit(index, false);
    });
    return this.mesh;
  }

  /**
   * Enciende o atenúa un anillo.
   *
   * @param index Número del anillo.
   * @param lit Si su perilla está señalada o se está girando.
   */
  public setLit(index: number, lit: boolean): void {
    const range = this.ranges[index];
    const colors = this.mesh.geometry.getAttribute('color') as BufferAttribute | undefined;
    if (!range || !colors) {
      return;
    }
    const { color, dim, lit: bright } = ScopeHalos.HALO;
    this.tint.set(color).multiplyScalar(lit ? bright : dim);
    const alpha = lit ? 1 : dim;
    for (let vertex = range.start; vertex < range.start + range.count; vertex += 1) {
      colors.setXYZW(vertex, this.tint.r, this.tint.g, this.tint.b, alpha);
    }
    colors.needsUpdate = true;
  }

  /**
   * Muestra u oculta los anillos (se apagan con el equipo).
   *
   * @param available Si las perillas responden.
   */
  public setAvailable(available: boolean): void {
    this.mesh.visible = available;
  }

  /**
   * Usa la geometría unida (con lugar para el color y la opacidad de cada vértice) como la de la malla.
   *
   * @param merged Anillos unidos, o `null` si no hay.
   */
  private adopt(merged: BufferGeometry | null): void {
    if (!merged) {
      return;
    }
    const colors = new Float32Array(merged.getAttribute('position').count * ScopeHalos.RGBA);
    merged.setAttribute('color', new BufferAttribute(colors, ScopeHalos.RGBA));
    this.mesh.geometry.dispose();
    this.mesh.geometry = merged;
  }

  /**
   * Vértices ya ocupados por los anillos anteriores.
   *
   * @returns Cantidad de vértices.
   */
  private count(): number {
    const last = this.ranges[this.ranges.length - 1];
    return last ? last.start + last.count : 0;
  }
}
