import {
  BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
  type MeshBasicMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ProxyAtlas } from './ProxyAtlas';
import type { ProxyEntry } from './ProxyEntry';
import type { ProxyKind } from './ProxyKind';
import { ProxyRig } from './ProxyRig';
import { ProxyShader } from './ProxyShader';

/**
 * Un lote de la versión unida de una zona: las mallas originales que comparten clave, llevadas a su posición
 * en el mundo y unidas en una sola malla. Cada material original tiene sus rangos de vértices; en cada
 * {@link ProxyBatch.sync} se comparan sus valores actuales (color, brillo, rugosidad, metal) con los copiados y,
 * si alguno cambió (un LED que parpadea, una luz que se enciende), se reescriben solo esos vértices. Un lote
 * articulado ({@link ProxyRig}) deja cada malla en su propio espacio y la mueve con su matriz actual.
 */
export class ProxyBatch {
  private static readonly LIT_STRIDE = 8;
  private static readonly LAYOUT = { emissive: 3, surface: 6 };
  private static readonly BASIC_STRIDE = 3;
  private static readonly RGB = 3;
  private static readonly TRIANGLE = 3;
  private static readonly SURFACE = 2;
  private static readonly RIG = new ProxyRig();

  public readonly mesh: Mesh;

  private readonly entries: ProxyEntry[];
  private readonly ranges = new Map<Mesh, { start: number; count: number }>();
  private readonly current: Float32Array;
  private readonly atlas: ProxyAtlas | null;
  private readonly rigid: boolean;

  /**
   * Arma el lote.
   *
   * @param kind Tipo de lote.
   * @param sources Mallas originales (misma clave), con sus matrices del mundo al día.
   * @param options Opciones del lote.
   * @param options.atlas Atlas con las texturas de color de las mallas (si las tienen distintas), o `null`.
   * @param options.layers Capas del lote (las de sus mallas: la cámara y, si brillan, el reflejo).
   * @param options.rigid Si es articulado (sus mallas se mueven y cada una es un hueso).
   */
  public constructor(
    private readonly kind: ProxyKind,
    sources: readonly Mesh[],
    options: { atlas: ProxyAtlas | null; layers: number; rigid: boolean },
  ) {
    this.atlas = options.atlas;
    this.rigid = options.rigid;
    this.current = new Float32Array(kind === 'lit' ? ProxyBatch.LIT_STRIDE : ProxyBatch.BASIC_STRIDE);
    this.entries = ProxyBatch.group(sources, this.current.length);
    this.index(sources);
    const geometry = this.geometry(sources);
    const material = this.material(sources);
    this.mesh = this.rigid ? ProxyBatch.RIG.mesh(geometry, material, sources) : new Mesh(geometry, material);
    this.mesh.layers.mask = options.layers;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.matrixWorldAutoUpdate = false;
    this.sync(true);
  }

  /**
   * Copia a los vértices los valores de los materiales originales que cambiaron.
   *
   * @param force Reescribir todo aunque no haya cambios.
   * @param share Parte de los materiales que se revisa en este frame: `every` indica cada cuántos (1 = todos)
   * y `turn`, el frame actual, cuáles tocan (así en las zonas que no se usan la revisión se reparte).
   * @param share.every Cada cuántos materiales se revisa uno.
   * @param share.turn Frame actual.
   */
  public sync(force = false, share = { every: 1, turn: 0 }): void {
    this.entries.forEach((entry, index) => {
      if (!force && (index + share.turn) % share.every !== 0) {
        return;
      }
      this.read(entry.material);
      if (!force && this.current.every((value, index) => value === entry.last[index])) {
        return;
      }
      entry.last.set(this.current);
      entry.ranges.forEach(({ start, count }) => {
        this.write(start, count);
      });
    });
  }

  /**
   * Apaga en el lote los vértices de una malla (que ahora se dibuja como original).
   *
   * @param mesh Malla original.
   */
  public drop(mesh: Mesh): void {
    const range = this.ranges.get(mesh);
    if (!range) {
      return;
    }
    const attribute = this.mesh.geometry.getAttribute('proxyVisible') as BufferAttribute;
    (attribute.array as Float32Array).fill(0, range.start, range.start + range.count);
    attribute.addUpdateRange(range.start, range.count);
    attribute.needsUpdate = true;
  }

  /**
   * Libera la geometría y el material del lote.
   */
  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as Material).dispose();
    this.atlas?.texture.dispose();
  }

  /**
   * Anota el rango de vértices de cada malla en la geometría unida.
   *
   * @param sources Mallas originales, en el orden en que se unen.
   */
  private index(sources: readonly Mesh[]): void {
    let start = 0;
    sources.forEach((mesh) => {
      const count = mesh.geometry.getAttribute('position').count;
      this.ranges.set(mesh, { start, count });
      start += count;
    });
  }

  /**
   * Lleva cada geometría al mundo, le agrega los atributos por vértice y las une.
   *
   * @param sources Mallas originales.
   * @returns Geometría unida.
   * @throws {Error} Si las geometrías no se pueden unir (atributos incompatibles).
   */
  private geometry(sources: readonly Mesh[]): BufferGeometry {
    const parts = sources.map((mesh, bone) => this.part(mesh, bone));
    const merged = mergeGeometries(parts) as BufferGeometry | null;
    parts.forEach((part) => {
      part.dispose();
    });
    if (!merged) {
      throw new Error('ProxyBatch: geometrías incompatibles en un mismo lote');
    }
    return merged;
  }

  /**
   * Copia de la geometría de una malla en el mundo (o en su espacio, atada a su hueso, si el lote es
   * articulado), con los atributos por vértice (vacíos) del lote.
   *
   * @param mesh Malla original.
   * @param bone Posición de la malla en el lote (su hueso, si es articulado).
   * @returns Geometría lista para unir.
   */
  private part(mesh: Mesh, bone: number): BufferGeometry {
    const part = this.place(mesh, bone);
    const count = part.getAttribute('position').count;
    const attribute = (size: number): BufferAttribute =>
      new BufferAttribute(new Float32Array(count * size), size);
    part.setAttribute('color', attribute(ProxyBatch.RGB));
    part.setAttribute('proxyVisible', new BufferAttribute(new Float32Array(count).fill(1), 1));
    this.remap(part, mesh);
    if (this.kind === 'lit') {
      part.setAttribute('proxyEmissive', attribute(ProxyBatch.RGB));
      part.setAttribute('proxySurface', attribute(ProxyBatch.SURFACE));
    }
    return part;
  }

  /**
   * Copia la geometría de una malla en el espacio del lote: el mundo, o el de la malla atada a su hueso si el
   * lote es articulado. Si la malla está espejada invierte sus triángulos.
   *
   * @param mesh Malla original.
   * @param bone Posición de la malla en el lote.
   * @returns Copia de la geometría.
   */
  private place(mesh: Mesh, bone: number): BufferGeometry {
    const part = mesh.geometry.clone();
    if (this.rigid) {
      ProxyBatch.RIG.attach(part, bone);
    } else {
      part.applyMatrix4(mesh.matrixWorld);
    }
    if (mesh.matrixWorld.determinant() < 0) {
      ProxyBatch.flip(part);
    }
    return part;
  }

  /**
   * Lleva las coordenadas de textura de una malla a su rincón del atlas.
   *
   * @param part Geometría copiada.
   * @param mesh Malla original (su material dice qué textura usa).
   */
  private remap(part: BufferGeometry, mesh: Mesh): void {
    const map = (mesh.material as MeshBasicMaterial).map;
    if (!this.atlas || !map) {
      return;
    }
    const rect = this.atlas.uvRect(map);
    const uv = part.getAttribute('uv') as BufferAttribute;
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(index, rect.u + uv.getX(index) * rect.width, rect.v + uv.getY(index) * rect.height);
    }
  }

  /**
   * Lee los valores actuales de un material original.
   *
   * @param material Material original.
   */
  private read(material: Material): void {
    const values = this.current;
    const { emissive: glowAt, surface } = ProxyBatch.LAYOUT;
    if (material instanceof MeshStandardMaterial) {
      const { color, emissive, emissiveIntensity: glow } = material;
      ProxyBatch.put(values, 0, color.r, color.g, color.b);
      ProxyBatch.put(values, glowAt, emissive.r * glow, emissive.g * glow, emissive.b * glow);
      values[surface] = material.roughness;
      values[surface + 1] = material.metalness;
      return;
    }
    const { color } = material as MeshBasicMaterial;
    ProxyBatch.put(values, 0, color.r, color.g, color.b);
  }

  /**
   * Escribe los valores leídos en un rango de vértices y marca solo ese tramo para subirlo a la GPU.
   *
   * @param start Primer vértice.
   * @param count Cantidad de vértices.
   */
  private write(start: number, count: number): void {
    const values = this.current;
    this.fill('color', start, count, values.subarray(0, ProxyBatch.RGB));
    if (this.kind === 'lit') {
      const { emissive, surface } = ProxyBatch.LAYOUT;
      this.fill('proxyEmissive', start, count, values.subarray(emissive, surface));
      this.fill('proxySurface', start, count, values.subarray(surface));
    }
  }

  /**
   * Repite un valor en todos los vértices de un rango de un atributo.
   *
   * @param name Atributo.
   * @param start Primer vértice.
   * @param count Cantidad de vértices.
   * @param value Valor (un elemento del atributo).
   */
  private fill(name: string, start: number, count: number, value: Float32Array): void {
    const attribute = this.mesh.geometry.getAttribute(name) as BufferAttribute;
    const size = attribute.itemSize;
    const array = attribute.array as Float32Array;
    for (let vertex = start; vertex < start + count; vertex += 1) {
      array.set(value, vertex * size);
    }
    attribute.addUpdateRange(start * size, count * size);
    attribute.needsUpdate = true;
  }

  /**
   * Material del lote, copiado del primer material del grupo (con el atlas como textura, si hay).
   *
   * @param sources Mallas originales.
   * @returns Material del lote.
   */
  private material(sources: readonly Mesh[]): Material {
    const template = sources[0]?.material as Material;
    const shader = new ProxyShader();
    const material =
      this.kind === 'lit'
        ? shader.lit(template as MeshStandardMaterial)
        : shader.basic(template as MeshBasicMaterial);
    if (this.atlas) {
      (material as MeshBasicMaterial).map = this.atlas.texture;
    }
    return material;
  }

  /**
   * Invierte el orden de los vértices de cada triángulo de una geometría que se copió con una matriz espejada:
   * sin esto el frente y el dorso quedarían cambiados.
   *
   * @param geometry Geometría ya en el mundo.
   */
  private static flip(geometry: BufferGeometry): void {
    const index = geometry.index;
    if (index) {
      const array = index.array;
      for (let corner = 0; corner + 2 < array.length; corner += ProxyBatch.TRIANGLE) {
        const second = array[corner + 1] ?? 0;
        array[corner + 1] = array[corner + 2] ?? 0;
        array[corner + 2] = second;
      }
      return;
    }
    Object.values(geometry.attributes).forEach((attribute) => {
      ProxyBatch.swapCorners(attribute as BufferAttribute);
    });
  }

  /**
   * Cambia de lugar el segundo y el tercer vértice de cada triángulo en un atributo sin índice.
   *
   * @param attribute Atributo.
   */
  private static swapCorners(attribute: BufferAttribute): void {
    const size = attribute.itemSize;
    const array = attribute.array;
    for (let vertex = 0; vertex + 2 < attribute.count; vertex += ProxyBatch.TRIANGLE) {
      const second = array.slice((vertex + 1) * size, (vertex + 2) * size);
      array.copyWithin((vertex + 1) * size, (vertex + 2) * size, (vertex + 3) * size);
      array.set(second, (vertex + 2) * size);
    }
  }

  /**
   * Agrupa las mallas por material, con el rango de vértices que ocupa cada una en la geometría unida.
   *
   * @param sources Mallas originales, en el orden en que se unen.
   * @param stride Cantidad de valores copiados por material.
   * @returns Entradas por material.
   */
  private static group(sources: readonly Mesh[], stride: number): ProxyEntry[] {
    const entries = new Map<Material, ProxyEntry>();
    let start = 0;
    sources.forEach((mesh) => {
      const material = mesh.material as Material;
      const entry = entries.get(material) ?? { material, ranges: [], last: new Float32Array(stride) };
      const count = mesh.geometry.getAttribute('position').count;
      entry.ranges.push({ start, count });
      entries.set(material, entry);
      start += count;
    });
    return [...entries.values()];
  }

  /**
   * Copia tres valores en un arreglo, sin reservar memoria nueva.
   *
   * @param values Arreglo destino.
   * @param at Posición del primero.
   * @param x Primer valor.
   * @param y Segundo valor.
   * @param z Tercer valor.
   */
  private static put(values: Float32Array, at: number, x: number, y: number, z: number): void {
    values[at] = x;
    values[at + 1] = y;
    values[at + 2] = z;
  }
}
