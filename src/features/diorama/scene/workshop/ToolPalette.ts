import { DoubleSide, type MeshStandardMaterialParameters } from 'three';

/**
 * Acabados de las herramientas de la pared (metales, mangos, plásticos). Cada herramienta crea sus propios
 * materiales con estos acabados para poder resaltarse sola.
 * Se comparte una sola instancia.
 */
export class ToolPalette {
  public readonly steel: MeshStandardMaterialParameters = {
    color: 0x9aa3ab,
    roughness: 0.34,
    metalness: 0.85,
    envMapIntensity: 0.5,
  };
  public readonly chrome: MeshStandardMaterialParameters = {
    color: 0xc9d0d6,
    roughness: 0.2,
    metalness: 1,
    envMapIntensity: 0.6,
  };
  public readonly darkSteel: MeshStandardMaterialParameters = {
    color: 0x3b4047,
    roughness: 0.42,
    metalness: 0.8,
    envMapIntensity: 0.4,
  };
  public readonly redGrip: MeshStandardMaterialParameters = {
    color: 0xc4262e,
    roughness: 0.55,
    metalness: 0,
    envMapIntensity: 0.3,
  };
  public readonly blueGrip: MeshStandardMaterialParameters = {
    color: 0x2362c9,
    roughness: 0.55,
    metalness: 0,
    envMapIntensity: 0.3,
  };
  public readonly yellowGrip: MeshStandardMaterialParameters = {
    color: 0xf2b705,
    roughness: 0.5,
    metalness: 0,
    envMapIntensity: 0.2,
    flatShading: true,
  };
  public readonly orangeGrip: MeshStandardMaterialParameters = {
    color: 0xf26b1d,
    roughness: 0.55,
    metalness: 0,
    envMapIntensity: 0.25,
  };
  public readonly redHandle: MeshStandardMaterialParameters = {
    color: 0xd0232c,
    roughness: 0.35,
    metalness: 0,
    envMapIntensity: 0.3,
    flatShading: true,
  };
  public readonly blackRubber: MeshStandardMaterialParameters = {
    color: 0x17181b,
    roughness: 0.75,
    metalness: 0,
    envMapIntensity: 0.3,
  };
  public readonly esdBlue: MeshStandardMaterialParameters = {
    color: 0x1f4fa8,
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.3,
  };
  public readonly vinyl: MeshStandardMaterialParameters = {
    color: 0x101114,
    roughness: 0.28,
    metalness: 0,
    envMapIntensity: 0.5,
  };
  public readonly cardboard: MeshStandardMaterialParameters = {
    color: 0xb08a5a,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.15,
    side: DoubleSide,
  };
  public readonly anodized: MeshStandardMaterialParameters = {
    color: 0x2f6fd6,
    roughness: 0.32,
    metalness: 0.7,
    envMapIntensity: 0.5,
  };
  public readonly teflon: MeshStandardMaterialParameters = {
    color: 0xe9e9e4,
    roughness: 0.6,
    metalness: 0,
    envMapIntensity: 0.15,
  };
  public readonly spool: MeshStandardMaterialParameters = {
    color: 0xe8742a,
    roughness: 0.5,
    metalness: 0,
    envMapIntensity: 0.25,
  };
  public readonly caliperBody: MeshStandardMaterialParameters = {
    color: 0x202328,
    roughness: 0.5,
    metalness: 0.1,
    envMapIntensity: 0.3,
  };
  public readonly solder: MeshStandardMaterialParameters = {
    color: 0xc4c9ce,
    roughness: 0.3,
    metalness: 1,
    envMapIntensity: 0.6,
  };
}
