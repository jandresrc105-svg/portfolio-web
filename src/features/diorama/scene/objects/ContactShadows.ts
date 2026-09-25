import { Mesh, MeshBasicMaterial, PlaneGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SceneObject } from '@shared/engine/SceneObject';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Sombras de contacto falsas: manchas oscuras difuminadas bajo cada objeto que toca el suelo.
 * Asientan la escena (sin ellas todo parece flotar) por el costo de un solo draw call, sin mapas de sombra.
 */
export class ContactShadows extends SceneObject {
  private static readonly SHADOWS = [
    { x: 0, y: 0.101, z: -0.1, width: 5.4, depth: 4.6, turn: 0 },
    { x: -1.4, y: 0.102, z: 1.5, width: 0.7, depth: 0.7, turn: 0 },
    { x: -0.47, y: 0.102, z: 1.5, width: 0.7, depth: 0.7, turn: 0 },
    { x: 0.47, y: 0.102, z: 1.5, width: 0.9, depth: 0.9, turn: 0 },
    { x: 1.4, y: 0.102, z: 1.5, width: 0.7, depth: 0.7, turn: 0 },
    { x: 3.72, y: 0.103, z: 0.25, width: 1.9, depth: 1.3, turn: -0.42 },
    { x: -4.05, y: 0.103, z: 0.8, width: 0.85, depth: 0.85, turn: 0 },
    { x: -4.72, y: 0.103, z: 1.82, width: 0.35, depth: 0.35, turn: 0 },
    { x: -3.75, y: 0.103, z: -0.95, width: 0.8, depth: 0.8, turn: 0 },
    { x: 2.95, y: 0.103, z: -2.4, width: 1, depth: 2.6, turn: 0 },
  ];
  private static readonly OPACITY = 0.62;

  /**
   * Crea las sombras.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const material = new MeshBasicMaterial({
      color: 0x000000,
      map: this.own(this.textures.shadowBlob()),
      transparent: true,
      opacity: ContactShadows.OPACITY,
      depthWrite: false,
    });
    const shadows = this.add(new Mesh(ContactShadows.geometry(), material));
    shadows.renderOrder = 1;
  }

  /**
   * Todas las manchas acostadas sobre el suelo en una sola geometría.
   *
   * @returns Geometría combinada.
   */
  private static geometry(): BufferGeometry {
    const pieces: BufferGeometry[] = ContactShadows.SHADOWS.map(({ x, y, z, width, depth, turn }) =>
      new PlaneGeometry(width, depth)
        .rotateX(-Math.PI / 2)
        .rotateY(turn)
        .translate(x, y, z),
    );
    const geometry = mergeGeometries(pieces);
    pieces.forEach((piece) => {
      piece.dispose();
    });
    return geometry;
  }
}
