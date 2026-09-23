import {
  ClampToEdgeWrapping,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SkinnedMesh,
  type BufferAttribute,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Texture,
} from 'three';
import type { ProxyKind } from './ProxyKind';

/**
 * Decide qué mallas pueden entrar en la versión unida de una zona y con qué otras comparten lote. Entran las
 * mallas opacas de un solo material estándar o básico (sin shaders propios); todo lo que cambia el shader o el
 * orden de dibujo (mapas, lados, niebla, tono, formato de los atributos) va en la clave, así el lote se dibuja
 * igual que cada original. Lo que cambia con el tiempo (color, brillo, rugosidad, metal) no va en la clave: lo
 * copia el lote por vértice en cada frame.
 */
export class ProxyKey {
  private static readonly CAMERA_ONLY = 1;
  private static readonly RESERVED = ['color', 'proxyEmissive', 'proxyRoughMetal'];
  private static readonly PHYSICAL = 'MeshPhysicalMaterial';

  private readonly inside = new WeakMap<BufferGeometry, boolean>();

  /**
   * Tipo de lote de una malla, o `null` si debe quedarse como está.
   *
   * @param mesh Malla.
   * @returns Tipo de lote.
   */
  public kind(mesh: Mesh): ProxyKind | null {
    if (!this.accepted(mesh)) {
      return null;
    }
    const material = mesh.material as Material;
    if (material instanceof MeshStandardMaterial) {
      return material.type !== ProxyKey.PHYSICAL && !material.displacementMap ? 'lit' : null;
    }
    return material instanceof MeshBasicMaterial && this.basicReady(mesh, material) ? 'basic' : null;
  }

  /**
   * Si la textura de color de una malla puede ir en un atlas: textura dibujable que no se repite ni se
   * transforma, único mapa del material y coordenadas de textura dentro del rango 0–1.
   *
   * @param mesh Malla.
   * @returns `true` si puede ir en un atlas.
   */
  public atlased(mesh: Mesh): boolean {
    const material = mesh.material as MeshStandardMaterial | MeshBasicMaterial;
    const map = material.map;
    if (!map || !this.plainMap(map) || !this.onlyMap(material)) {
      return false;
    }
    return this.uvInside(mesh.geometry);
  }

  /**
   * Clave del lote de una malla ya aceptada.
   *
   * @param mesh Malla.
   * @param kind Tipo de lote.
   * @returns Clave.
   */
  public of(mesh: Mesh, kind: ProxyKind): string {
    const material = mesh.material as Material;
    const geometry = mesh.geometry;
    const attributes = Object.entries(geometry.attributes)
      .map(([name, { itemSize, normalized, array }]) =>
        [name, itemSize, normalized, array.constructor.name].join(':'),
      )
      .sort();
    const shape = [attributes.join(','), geometry.index ? 'i' : 'n'];
    const common = [material.side, material.depthTest, material.depthWrite, material.polygonOffset];
    const atlas = this.atlased(mesh);
    const extra =
      material instanceof MeshStandardMaterial ? this.lit(material, atlas) : this.basic(material, atlas);
    return [kind, ...shape, ...common, ...extra].join('|');
  }

  /**
   * Si una malla cumple todas las condiciones para entrar en un lote.
   *
   * @param mesh Malla.
   * @returns `true` si se puede unir.
   */
  private accepted(mesh: Mesh): boolean {
    return this.plain(mesh) && this.placed(mesh) && this.opaque(mesh.material as Material);
  }

  /**
   * Malla simple: sin instancias ni esqueleto, un solo material y una geometría sin atributos reservados, sin
   * rango de dibujo parcial ni formas de mezcla.
   *
   * @param mesh Malla.
   * @returns `true` si es simple.
   */
  private plain(mesh: Mesh): boolean {
    if (mesh instanceof InstancedMesh || mesh instanceof SkinnedMesh || Array.isArray(mesh.material)) {
      return false;
    }
    const geometry = mesh.geometry;
    const reserved = ProxyKey.RESERVED.some((name) => name in geometry.attributes);
    const partial = geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity;
    return !reserved && !partial && Object.keys(geometry.morphAttributes).length === 0;
  }

  /**
   * Colocada de forma simple: sin espejo y solo en la capa de la cámara (lo que se refleja en los charcos
   * queda aparte).
   *
   * @param mesh Malla.
   * @returns `true` si se puede llevar al mundo sin cambiar su aspecto.
   */
  private placed(mesh: Mesh): boolean {
    const extraLayers = (mesh.layers.mask & ~ProxyKey.CAMERA_ONLY) !== 0;
    return !extraLayers && mesh.matrixWorld.determinant() > 0;
  }

  /**
   * Material visible, opaco, sin recorte y sin shader modificado.
   *
   * @param material Material.
   * @returns `true` si es opaco.
   */
  private opaque(material: Material): boolean {
    const custom =
      Object.hasOwn(material, 'onBeforeCompile') || Object.hasOwn(material, 'customProgramCacheKey');
    return material.visible && !material.transparent && material.alphaTest === 0 && !custom;
  }

  /**
   * Parte de la clave propia de un material estándar: mapas y parámetros fijos.
   *
   * @param material Material estándar.
   * @param atlas Si su textura de color va en un atlas (entonces no separa lotes).
   * @returns Valores de la clave.
   */
  private lit(material: MeshStandardMaterial, atlas: boolean): (string | number | boolean)[] {
    const maps = [
      atlas ? null : material.map,
      material.normalMap,
      material.roughnessMap,
      material.metalnessMap,
    ];
    const more = [material.emissiveMap, material.aoMap, material.bumpMap, material.lightMap, material.envMap];
    const { envMapIntensity, flatShading, fog, toneMapped, opacity, normalScale } = material;
    const scales = [normalScale.x, normalScale.y, material.aoMapIntensity, material.bumpScale];
    return [
      atlas ? `atlas:${material.map?.colorSpace ?? ''}` : '-',
      ...[...maps, ...more].map((texture) => this.texture(texture)),
      ...[envMapIntensity, flatShading, fog, toneMapped, opacity, ...scales, material.lightMapIntensity],
    ];
  }

  /**
   * Parte de la clave propia de un material básico.
   *
   * @param material Material básico.
   * @param atlas Si su textura de color va en un atlas.
   * @returns Valores de la clave.
   */
  private basic(material: Material, atlas: boolean): (string | number | boolean)[] {
    const basic = material as MeshBasicMaterial;
    const map = atlas ? `atlas:${basic.map?.colorSpace ?? ''}` : '-';
    return [map, basic.fog, basic.toneMapped, basic.opacity, this.texture(basic.envMap)];
  }

  /**
   * Si un material básico puede ir en un lote: sin recorte por textura y sin textura de color o con una que
   * va en un atlas.
   *
   * @param mesh Malla.
   * @param material Su material básico.
   * @returns `true` si puede ir.
   */
  private basicReady(mesh: Mesh, material: MeshBasicMaterial): boolean {
    return !material.alphaMap && (!material.map || this.atlased(mesh));
  }

  /**
   * Textura dibujable, sin repetición ni transformación, orientada como las de canvas.
   *
   * @param map Textura.
   * @returns `true` si se puede copiar a un atlas.
   */
  private plainMap(map: Texture): boolean {
    const clamped = map.wrapS === ClampToEdgeWrapping && map.wrapT === ClampToEdgeWrapping;
    return this.drawable(map.image) && clamped && this.untransformed(map) && map.flipY;
  }

  /**
   * Si una imagen se puede copiar a un lienzo.
   *
   * @param image Imagen de una textura.
   * @returns `true` si es un canvas, una imagen o un bitmap.
   */
  private drawable(image: unknown): boolean {
    return (
      image instanceof HTMLCanvasElement || image instanceof HTMLImageElement || image instanceof ImageBitmap
    );
  }

  /**
   * Si una textura no tiene desplazamiento, repetición ni giro.
   *
   * @param map Textura.
   * @returns `true` si no está transformada.
   */
  private untransformed(map: Texture): boolean {
    const { offset, repeat } = map;
    return offset.x === 0 && offset.y === 0 && repeat.x === 1 && repeat.y === 1 && map.rotation === 0;
  }

  /**
   * Si la textura de color es el único mapa del material.
   *
   * @param material Material.
   * @returns `true` si no usa otros mapas.
   */
  private onlyMap(material: MeshStandardMaterial | MeshBasicMaterial): boolean {
    if (material.alphaMap || material.aoMap || material.lightMap || material.envMap) {
      return false;
    }
    if (!(material instanceof MeshStandardMaterial)) {
      return true;
    }
    const maps = [material.normalMap, material.roughnessMap, material.metalnessMap, material.emissiveMap];
    return maps.every((texture) => texture === null) && material.bumpMap === null;
  }

  /**
   * Si todas las coordenadas de textura están dentro del rango 0–1 (se calcula una vez por geometría).
   *
   * @param geometry Geometría.
   * @returns `true` si están dentro.
   */
  private uvInside(geometry: BufferGeometry): boolean {
    const known = this.inside.get(geometry);
    if (known !== undefined) {
      return known;
    }
    const uv = geometry.getAttribute('uv') as BufferAttribute | undefined;
    const array = uv?.array ?? [];
    const inside =
      uv !== undefined && Array.prototype.every.call(array, (value: number) => value >= 0 && value <= 1);
    this.inside.set(geometry, inside);
    return inside;
  }

  /**
   * Identidad de una textura para la clave.
   *
   * @param texture Textura o `null`.
   * @returns Id de la textura o `-`.
   */
  private texture(texture: Texture | null): string {
    return texture ? texture.uuid : '-';
  }
}
