import { CanvasTexture, type Texture } from 'three';
import type { AtlasRegion } from './AtlasRegion';

/**
 * Atlas de texturas para los lotes de la versión unida: copia varias texturas (con margen, para que no se mezclen
 * al alejarse) en un solo lienzo y dice dónde quedó cada una, así mallas con texturas distintas se dibujan en un
 * solo lote. Como la versión unida solo se ve de lejos, las texturas se copian a una escala menor.
 */
export class ProxyAtlas {
  private static readonly PADDING = 4;
  private static readonly MIN_SIZE = 1;

  public readonly texture: CanvasTexture;

  private readonly regions = new Map<Texture, AtlasRegion>();
  private readonly size = { width: 0, height: 0 };

  /**
   * Arma el atlas.
   *
   * @param textures Texturas a copiar (con imagen dibujable).
   * @param scale Escala de copia.
   * @param maxSize Lado máximo del atlas.
   */
  public constructor(textures: readonly Texture[], scale: number, maxSize: number) {
    ProxyAtlas.pack(textures, scale, maxSize, this.regions, this.size);
    this.texture = this.paint(textures);
  }

  /**
   * Si una lista de texturas cabe en un atlas.
   *
   * @param textures Texturas.
   * @param scale Escala de copia.
   * @param maxSize Lado máximo.
   * @returns `true` si todas caben.
   */
  public static fits(textures: readonly Texture[], scale: number, maxSize: number): boolean {
    const regions = new Map<Texture, AtlasRegion>();
    ProxyAtlas.pack(textures, scale, maxSize, regions, { width: 0, height: 0 });
    return regions.size === textures.length;
  }

  /**
   * Rectángulo de una textura en coordenadas de textura del atlas (u, v de 0 a 1, con v hacia arriba como en
   * las texturas de canvas).
   *
   * @param texture Textura original.
   * @returns Origen y tamaño en el atlas.
   */
  public uvRect(texture: Texture): { u: number; v: number; width: number; height: number } {
    const region = this.regions.get(texture) ?? { x: 0, y: 0, width: 0, height: 0 };
    const { width, height } = this.size;
    return {
      u: region.x / width,
      v: 1 - (region.y + region.height) / height,
      width: region.width / width,
      height: region.height / height,
    };
  }

  /**
   * Copia las texturas al lienzo del atlas.
   *
   * @param textures Texturas.
   * @returns Textura del atlas.
   */
  private paint(textures: readonly Texture[]): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = this.size.width;
    canvas.height = this.size.height;
    const context = canvas.getContext('2d');
    textures.forEach((texture) => {
      const region = this.regions.get(texture);
      if (context && region) {
        const { x, y, width, height } = region;
        context.drawImage(texture.image as CanvasImageSource, x, y, width, height);
      }
    });
    const atlas = new CanvasTexture(canvas);
    atlas.colorSpace = textures[0]?.colorSpace ?? atlas.colorSpace;
    atlas.anisotropy = textures[0]?.anisotropy ?? atlas.anisotropy;
    return atlas;
  }

  /**
   * Acomoda las texturas en filas (de la más alta a la más baja) dentro del lado máximo.
   *
   * @param textures Texturas.
   * @param scale Escala de copia.
   * @param maxSize Lado máximo.
   * @param regions Donde se anotan las regiones que cupieron.
   * @param size Donde se anota el tamaño usado.
   * @param size.width Ancho usado.
   * @param size.height Alto usado.
   */
  private static pack(
    textures: readonly Texture[],
    scale: number,
    maxSize: number,
    regions: Map<Texture, AtlasRegion>,
    size: { width: number; height: number },
  ): void {
    const pad = ProxyAtlas.PADDING;
    const cursor = { x: pad, y: pad, row: 0 };
    const tallest = (a: Texture, b: Texture): number =>
      ProxyAtlas.dims(b, scale).height - ProxyAtlas.dims(a, scale).height;
    [...textures].sort(tallest).forEach((texture) => {
      const region = ProxyAtlas.place(ProxyAtlas.dims(texture, scale), cursor, maxSize);
      if (region) {
        regions.set(texture, region);
        size.width = Math.max(size.width, cursor.x);
      }
    });
    Object.assign(size, { width: Math.max(size.width, pad), height: cursor.y + cursor.row + pad });
  }

  /**
   * Busca lugar para un rectángulo en la fila actual o en la siguiente y avanza el cursor.
   *
   * @param dims Tamaño del rectángulo.
   * @param dims.width Ancho.
   * @param dims.height Alto.
   * @param cursor Posición libre y alto de la fila actual.
   * @param cursor.x Borde izquierdo libre.
   * @param cursor.y Borde superior de la fila.
   * @param cursor.row Alto de la fila.
   * @param maxSize Lado máximo.
   * @returns Región asignada, o `null` si no cabe.
   */
  private static place(
    dims: { width: number; height: number },
    cursor: { x: number; y: number; row: number },
    maxSize: number,
  ): AtlasRegion | null {
    const pad = ProxyAtlas.PADDING;
    if (cursor.x + dims.width + pad > maxSize) {
      cursor.x = pad;
      cursor.y += cursor.row + pad;
      cursor.row = 0;
    }
    if (cursor.y + dims.height + pad > maxSize) {
      return null;
    }
    const region = { x: cursor.x, y: cursor.y, ...dims };
    cursor.x += dims.width + pad;
    cursor.row = Math.max(cursor.row, dims.height);
    return region;
  }

  /**
   * Tamaño de una textura copiada a escala.
   *
   * @param texture Textura.
   * @param scale Escala.
   * @returns Ancho y alto en píxeles.
   */
  private static dims(texture: Texture, scale: number): { width: number; height: number } {
    const image = texture.image as { width: number; height: number };
    return {
      width: Math.max(Math.round(image.width * scale), ProxyAtlas.MIN_SIZE),
      height: Math.max(Math.round(image.height * scale), ProxyAtlas.MIN_SIZE),
    };
  }
}
