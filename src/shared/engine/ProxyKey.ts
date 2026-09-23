import {
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SkinnedMesh,
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
    return material instanceof MeshBasicMaterial && !material.map && !material.alphaMap ? 'basic' : null;
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
    const extra = material instanceof MeshStandardMaterial ? this.lit(material) : this.basic(material);
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
   * @returns Valores de la clave.
   */
  private lit(material: MeshStandardMaterial): (string | number | boolean)[] {
    const maps = [material.map, material.normalMap, material.roughnessMap, material.metalnessMap];
    const more = [material.emissiveMap, material.aoMap, material.bumpMap, material.lightMap, material.envMap];
    return [
      ...[...maps, ...more].map((texture) => this.texture(texture)),
      material.envMapIntensity,
      material.flatShading,
      material.fog,
      material.toneMapped,
      material.opacity,
      material.normalScale.x,
      material.normalScale.y,
      material.aoMapIntensity,
      material.bumpScale,
      material.lightMapIntensity,
    ];
  }

  /**
   * Parte de la clave propia de un material básico.
   *
   * @param material Material básico.
   * @returns Valores de la clave.
   */
  private basic(material: Material): (string | number | boolean)[] {
    const basic = material as MeshBasicMaterial;
    return [basic.fog, basic.toneMapped, basic.opacity, this.texture(basic.envMap)];
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
