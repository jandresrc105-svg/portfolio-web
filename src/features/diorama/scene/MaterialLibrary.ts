import { MeshStandardMaterial, type Texture } from 'three';
import type { CanvasTextureFactory } from './CanvasTextureFactory';

/**
 * Materiales compartidos del diorama (patrón Flyweight): una sola instancia por material para todas las piezas.
 */
export class MaterialLibrary {
  private static readonly COLORS = {
    woodDark: 0x3a2417,
    woodLight: 0x8a5634,
    roof: 0x1f222b,
    lacquer: 0xb01e28,
    metal: 0x8f98a3,
    darkMetal: 0x2a2e36,
    concrete: 0x4c4f57,
    asphalt: 0x14161b,
    rock: 0x24232a,
    cable: 0x09090b,
    ceramic: 0x17181d,
  };

  private static readonly WETNESS_REPEAT = 0.14;

  private static readonly FINISH = {
    woodDark: { roughness: 0.78, metalness: 0 },
    woodLight: { roughness: 0.55, metalness: 0 },
    roof: { roughness: 0.6, metalness: 0.3 },
    lacquer: { roughness: 0.32, metalness: 0 },
    metal: { roughness: 0.35, metalness: 0.8 },
    darkMetal: { roughness: 0.45, metalness: 0.6 },
    concrete: { roughness: 0.7, metalness: 0 },
    cable: { roughness: 0.4, metalness: 0 },
    ceramic: { roughness: 0.25, metalness: 0 },
  };

  public readonly woodDark = MaterialLibrary.standard('woodDark');
  public readonly woodLight = MaterialLibrary.standard('woodLight');
  public readonly roof = MaterialLibrary.standard('roof');
  public readonly lacquer = MaterialLibrary.standard('lacquer');
  public readonly metal = MaterialLibrary.standard('metal');
  public readonly darkMetal = MaterialLibrary.standard('darkMetal');
  public readonly concrete = MaterialLibrary.standard('concrete');
  public readonly cable = MaterialLibrary.standard('cable');
  public readonly ceramic = MaterialLibrary.standard('ceramic');
  public readonly rock = new MeshStandardMaterial({
    color: MaterialLibrary.COLORS.rock,
    roughness: 0.92,
    flatShading: true,
  });
  public readonly asphalt: MeshStandardMaterial;

  private readonly wetness: Texture;

  /**
   * Crea la biblioteca de materiales.
   *
   * @param textures Fábrica de texturas para el mapa de humedad del asfalto.
   */
  public constructor(textures: CanvasTextureFactory) {
    this.wetness = textures.wetness();
    this.wetness.repeat.setScalar(MaterialLibrary.WETNESS_REPEAT);
    this.asphalt = new MeshStandardMaterial({
      color: MaterialLibrary.COLORS.asphalt,
      roughness: 0.9,
      metalness: 0.25,
      roughnessMap: this.wetness,
    });
  }

  /**
   * Libera todos los materiales y texturas.
   */
  public dispose(): void {
    Object.values(this).forEach((value: unknown) => {
      if (value instanceof MeshStandardMaterial) {
        value.dispose();
      }
    });
    this.wetness.dispose();
  }

  /**
   * Crea un material PBR estándar con el color y acabado registrados bajo un nombre.
   *
   * @param name Nombre del material.
   * @returns Material.
   */
  private static standard(name: keyof typeof MaterialLibrary.FINISH): MeshStandardMaterial {
    return new MeshStandardMaterial({ color: MaterialLibrary.COLORS[name], ...MaterialLibrary.FINISH[name] });
  }
}
