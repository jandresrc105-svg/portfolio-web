import { MeshStandardMaterial, type Texture } from 'three';
import type { CanvasTextureFactory } from './CanvasTextureFactory';

/**
 * Materiales compartidos del diorama (patrón Flyweight): una sola instancia por material para todas las piezas.
 */
export class MaterialLibrary {
  private static readonly COLORS = {
    woodDark: 0x3a2417,
    woodLight: 0x8a5634,
    roof: 0x565b69,
    lacquer: 0xb01e28,
    metal: 0x8f98a3,
    darkMetal: 0x2a2e36,
    concrete: 0x4c4f57,
    asphalt: 0x2b2d35,
    rock: 0x24232a,
    cable: 0x09090b,
    ceramic: 0x17181d,
  };

  private static readonly WETNESS_REPEAT = 0.14;
  private static readonly ASPHALT_REPEAT = 0.45;
  private static readonly WOOD_REPEAT = { x: 1, y: 2 };
  private static readonly ROOF_REPEAT = { x: 4, y: 1 };
  private static readonly ASPHALT_FINISH = { roughness: 0.88, metalness: 0.15, envMapIntensity: 0.06 };

  private static readonly FINISH = {
    woodDark: { roughness: 0.78, metalness: 0, envMapIntensity: 0.2 },
    woodLight: { roughness: 0.55, metalness: 0, envMapIntensity: 0.45 },
    roof: { roughness: 0.6, metalness: 0.3, envMapIntensity: 0.6 },
    lacquer: { roughness: 0.32, metalness: 0, envMapIntensity: 0.6 },
    metal: { roughness: 0.35, metalness: 0.8 },
    darkMetal: { roughness: 0.45, metalness: 0.6 },
    concrete: { roughness: 0.7, metalness: 0, envMapIntensity: 0.35 },
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
    envMapIntensity: 0.1,
  });
  public readonly asphalt: MeshStandardMaterial;

  private readonly wetness: Texture;
  private readonly textures: Texture[] = [];

  /**
   * Crea la biblioteca de materiales.
   *
   * @param textures Fábrica de texturas para el mapa de humedad del asfalto.
   */
  public constructor(textures: CanvasTextureFactory) {
    this.wetness = textures.wetness();
    this.wetness.repeat.setScalar(MaterialLibrary.WETNESS_REPEAT);
    const grain = this.track(textures.asphalt());
    grain.repeat.setScalar(MaterialLibrary.ASPHALT_REPEAT);
    this.asphalt = new MeshStandardMaterial({
      color: MaterialLibrary.COLORS.asphalt,
      map: grain,
      roughnessMap: this.wetness,
      ...MaterialLibrary.ASPHALT_FINISH,
    });
    this.dress(textures);
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
    this.textures.forEach((texture) => {
      texture.dispose();
    });
  }

  /**
   * Aplica veta de madera a las maderas y chapa corrugada al techo.
   *
   * @param textures Fábrica de texturas.
   */
  private dress(textures: CanvasTextureFactory): void {
    const wood = this.track(textures.woodGrain());
    wood.repeat.set(MaterialLibrary.WOOD_REPEAT.x, MaterialLibrary.WOOD_REPEAT.y);
    this.woodDark.map = wood;
    this.woodLight.map = wood;
    const roof = this.track(textures.corrugated());
    roof.repeat.set(MaterialLibrary.ROOF_REPEAT.x, MaterialLibrary.ROOF_REPEAT.y);
    this.roof.map = roof;
    this.roof.bumpMap = roof;
  }

  /**
   * Registra una textura para liberarla con la biblioteca.
   *
   * @param texture Textura.
   * @returns La misma textura.
   */
  private track(texture: Texture): Texture {
    this.textures.push(texture);
    return texture;
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
