import { AtomEmblem } from './AtomEmblem';
import { BadgeEmblem } from './BadgeEmblem';
import { BoxesEmblem } from './BoxesEmblem';
import { BranchEmblem } from './BranchEmblem';
import type { CanFlavor } from './CanFlavor';
import { ChipEmblem } from './ChipEmblem';
import { CubeEmblem } from './CubeEmblem';
import { DatabaseEmblem } from './DatabaseEmblem';
import { GlyphEmblem } from './GlyphEmblem';
import { HexagonEmblem } from './HexagonEmblem';
import { LeafEmblem } from './LeafEmblem';
import { ShieldEmblem } from './ShieldEmblem';
import { SmileEmblem } from './SmileEmblem';
import { SparkEmblem } from './SparkEmblem';
import { TriangleEmblem } from './TriangleEmblem';
import { VeeEmblem } from './VeeEmblem';
import { WaveEmblem } from './WaveEmblem';

/**
 * Catálogo de sabores de lata: una tecnología (o grupo de tecnologías) por sabor, con su emblema y colores.
 * Los emblemas son dibujos simples inspirados en cada tecnología, no sus logos oficiales.
 */
export class CanFlavors {
  private static readonly GLYPH = new GlyphEmblem();
  private static readonly BADGE = new BadgeEmblem();

  public readonly all: readonly CanFlavor[] = [
    {
      id: 'web',
      name: 'HTML · CSS · JS',
      glyph: '</>',
      emblem: CanFlavors.GLYPH,
      base: '#e8562a',
      shade: '#8f2c10',
      accent: '#ffb347',
      ink: '#ffffff',
    },
    {
      id: 'typescript',
      name: 'TypeScript',
      glyph: 'TS',
      emblem: CanFlavors.BADGE,
      base: '#3b86d8',
      shade: '#173f78',
      accent: '#7cb8ff',
      ink: '#ffffff',
    },
    {
      id: 'react',
      name: 'React',
      glyph: '',
      emblem: new AtomEmblem(),
      base: '#23272f',
      shade: '#0b0d11',
      accent: '#2f6f86',
      ink: '#61dafb',
    },
    {
      id: 'vue',
      name: 'Vue',
      glyph: '',
      emblem: new VeeEmblem(),
      base: '#2c3e50',
      shade: '#152029',
      accent: '#41b883',
      ink: '#41b883',
    },
    {
      id: 'angular',
      name: 'Angular',
      glyph: 'A',
      emblem: new ShieldEmblem(),
      base: '#d6153a',
      shade: '#6e0718',
      accent: '#ff6b8a',
      ink: '#ffffff',
    },
    {
      id: 'threejs',
      name: 'Three.js · WebGL',
      glyph: '',
      emblem: new TriangleEmblem(),
      base: '#14213d',
      shade: '#04070f',
      accent: '#4cc9f0',
      ink: '#e8f7ff',
    },
    {
      id: 'node',
      name: 'Node.js',
      glyph: 'JS',
      emblem: new HexagonEmblem(),
      base: '#3f873f',
      shade: '#1b3d1b',
      accent: '#8cc84b',
      ink: '#ffffff',
    },
    {
      id: 'dotnet',
      name: '.NET · C#',
      glyph: '.NET',
      emblem: CanFlavors.GLYPH,
      base: '#6a3fd6',
      shade: '#2c1470',
      accent: '#a68bff',
      ink: '#ffffff',
    },
    {
      id: 'unity',
      name: 'Unity',
      glyph: '',
      emblem: new CubeEmblem(),
      base: '#2b2f36',
      shade: '#07080a',
      accent: '#5b6472',
      ink: '#ffffff',
    },
    {
      id: 'python',
      name: 'Python',
      glyph: 'Py',
      emblem: CanFlavors.GLYPH,
      base: '#3572a5',
      shade: '#1b3a57',
      accent: '#ffd43b',
      ink: '#ffd43b',
    },
    {
      id: 'micropython',
      name: 'MicroPython',
      glyph: 'µPy',
      emblem: CanFlavors.GLYPH,
      base: '#1f2a36',
      shade: '#090d12',
      accent: '#34c38f',
      ink: '#9df5c9',
    },
    {
      id: 'cpp',
      name: 'C / C++',
      glyph: 'C++',
      emblem: CanFlavors.GLYPH,
      base: '#00599c',
      shade: '#002b4d',
      accent: '#659ad2',
      ink: '#ffffff',
    },
    {
      id: 'embedded',
      name: 'Embebidos',
      glyph: '',
      emblem: new ChipEmblem(),
      base: '#00878a',
      shade: '#00393b',
      accent: '#62d2c8',
      ink: '#e9fffd',
    },
    {
      id: 'automation',
      name: 'Automatización',
      glyph: '',
      emblem: new WaveEmblem(),
      base: '#2b2d42',
      shade: '#0d0e17',
      accent: '#ffb000',
      ink: '#8ef58e',
    },
    {
      id: 'ai',
      name: 'IA',
      glyph: '',
      emblem: new SparkEmblem(),
      base: '#7c3aed',
      shade: '#2e0f6b',
      accent: '#f0abfc',
      ink: '#ffffff',
    },
    {
      id: 'sql',
      name: 'SQL · PostgreSQL',
      glyph: '',
      emblem: new DatabaseEmblem(),
      base: '#336791',
      shade: '#152d42',
      accent: '#8fb8de',
      ink: '#ffffff',
    },
    {
      id: 'mongodb',
      name: 'MongoDB',
      glyph: '',
      emblem: new LeafEmblem(),
      base: '#0f3d2e',
      shade: '#021a12',
      accent: '#00ed64',
      ink: '#00ed64',
    },
    {
      id: 'docker',
      name: 'Docker · Linux',
      glyph: '',
      emblem: new BoxesEmblem(),
      base: '#2496ed',
      shade: '#0d4f86',
      accent: '#8fd0ff',
      ink: '#ffffff',
    },
    {
      id: 'aws',
      name: 'AWS',
      glyph: 'aws',
      emblem: new SmileEmblem(),
      base: '#232f3e',
      shade: '#0b1017',
      accent: '#ff9900',
      ink: '#ffffff',
    },
    {
      id: 'git',
      name: 'Git · CI/CD',
      glyph: '',
      emblem: new BranchEmblem(),
      base: '#f05032',
      shade: '#8a2210',
      accent: '#ffc2b3',
      ink: '#ffffff',
    },
  ];

  /**
   * Posición de un sabor en el catálogo (y celda de su etiqueta en el atlas).
   *
   * @param id Identificador del sabor.
   * @returns Índice, o -1 si no existe.
   */
  public indexOf(id: string): number {
    return this.all.findIndex((flavor) => flavor.id === id.trim().toLowerCase());
  }
}
