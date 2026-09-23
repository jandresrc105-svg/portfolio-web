import type { MeshBasicMaterial, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from 'three';

/**
 * Materiales de los lotes de la versión unida. Son copias exactas del material original (mismos mapas, lados,
 * entorno y tono), salvo que lo que cambia con el tiempo viene por vértice: el color (atributo `color`, que
 * three.js ya multiplica), el brillo emisivo (`proxyEmissive`) y la rugosidad y el metal (`proxyRoughMetal`).
 * En el shader solo se cambia de dónde salen esos tres valores; el resto del cálculo de luz es el de three.js,
 * así que el resultado en pantalla es el mismo.
 */
export class ProxyShader {
  private static readonly VERTEX_HEAD = [
    'attribute vec3 proxyEmissive;',
    'attribute vec2 proxyRoughMetal;',
    'varying vec3 vProxyEmissive;',
    'varying vec2 vProxyRoughMetal;',
  ].join('\n');
  private static readonly VERTEX_BODY = [
    '#include <begin_vertex>',
    'vProxyEmissive = proxyEmissive;',
    'vProxyRoughMetal = proxyRoughMetal;',
  ].join('\n');
  private static readonly FRAGMENT_HEAD = [
    'varying vec3 vProxyEmissive;',
    'varying vec2 vProxyRoughMetal;',
  ].join('\n');
  private static readonly ROUGHNESS = [
    '#define roughness vProxyRoughMetal.x',
    '#include <roughnessmap_fragment>',
    '#undef roughness',
  ].join('\n');
  private static readonly METALNESS = [
    '#define metalness vProxyRoughMetal.y',
    '#include <metalnessmap_fragment>',
    '#undef metalness',
  ].join('\n');
  private static readonly CACHE_KEY = 'proxy-lit';
  private static readonly WHITE = 0xffffff;
  private static readonly BLACK = 0x000000;

  /**
   * Material iluminado de un lote, a partir del primer material del grupo.
   *
   * @param template Material original (todos los del lote comparten estos parámetros).
   * @returns Material del lote.
   */
  public lit(template: MeshStandardMaterial): MeshStandardMaterial {
    const material = template.clone();
    material.color.set(ProxyShader.WHITE);
    material.emissive.set(ProxyShader.BLACK);
    material.vertexColors = true;
    material.onBeforeCompile = (shader): void => {
      this.inject(shader);
    };
    material.customProgramCacheKey = (): string => ProxyShader.CACHE_KEY;
    return material;
  }

  /**
   * Material sin iluminación de un lote: el color sale del vértice.
   *
   * @param template Material original.
   * @returns Material del lote.
   */
  public basic(template: MeshBasicMaterial): MeshBasicMaterial {
    const material = template.clone();
    material.color.set(ProxyShader.WHITE);
    material.vertexColors = true;
    return material;
  }

  /**
   * Cambia el origen del brillo, la rugosidad y el metal en el shader estándar.
   *
   * @param shader Programa que three.js está por compilar.
   */
  private inject(shader: WebGLProgramParametersWithUniforms): void {
    shader.vertexShader = `${ProxyShader.VERTEX_HEAD}\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      ProxyShader.VERTEX_BODY,
    );
    shader.fragmentShader = `${ProxyShader.FRAGMENT_HEAD}\n${shader.fragmentShader}`
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vProxyEmissive;')
      .replace('#include <roughnessmap_fragment>', ProxyShader.ROUGHNESS)
      .replace('#include <metalnessmap_fragment>', ProxyShader.METALNESS);
  }
}
