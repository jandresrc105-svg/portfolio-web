import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import { Steam } from './Steam';

/**
 * Bol de ramen completo: tazón negro con banda roja, caldo dorado con gotas de grasa, fideos, chashu,
 * huevo marinado, narutomaki, nori, menma y cebollín, con su columna de vapor.
 */
export class RamenBowl extends SceneObject implements Updatable {
  private static readonly POSITION = { x: 0.42, y: 1.09, z: 1 };
  private static readonly BOWL = { radius: 0.17, foot: 0.07, height: 0.12, wall: 0.012, segments: 14 };
  private static readonly BROTH = { radius: 0.152, y: 0.1 };
  private static readonly NOODLES = { strands: 9, radius: 0.0045, points: 6, reach: 0.11, lift: 0.006 };
  private static readonly CHASHU = [
    { x: -0.06, z: -0.045, tilt: 0.18, turn: 0.4 },
    { x: -0.02, z: -0.085, tilt: 0.28, turn: 1.1 },
  ];
  private static readonly CHASHU_SIZE = { radius: 0.05, thickness: 0.012 };
  private static readonly EGG = { radius: 0.03, scaleZ: 1.3, yolk: 0.017, x: 0.075, z: -0.03, lift: 0.008 };
  private static readonly NARUTO = { radius: 0.028, thickness: 0.008, x: 0.055, z: 0.06, tilt: 0.15 };
  private static readonly NORI = { width: 0.085, height: 0.11, x: -0.02, z: -0.13, tilt: -0.35 };
  private static readonly MENMA = { count: 4, width: 0.012, height: 0.008, length: 0.045, x: 0.09, z: 0.03 };
  private static readonly NEGI = { count: 16, radius: 0.0065, height: 0.004, spread: 0.06, x: 0.02, z: 0.02 };
  private static readonly COLORS = {
    glaze: 0x0d0c10,
    noodle: 0xf2d27a,
    egg: 0xf6efe2,
    nori: 0x13241a,
    menma: 0xb58445,
    negi: 0x7ccf4a,
  };
  private static readonly STEAM = {
    count: 42,
    height: 0.8,
    speed: 0.22,
    spread: 0.1,
    size: 0.16,
    opacity: 0.2,
  };
  private static readonly CANVAS = { size: 128, bowl: 256 };
  private static readonly GLAZE_BANDS = [
    { color: '#9e1622', from: 0, height: 0.46 },
    { color: '#b3162a', from: 0.52, height: 0.1 },
    { color: '#d8b25a', from: 0.5, height: 0.015 },
    { color: '#d8b25a', from: 0.63, height: 0.01 },
  ];
  private static readonly YOLK = { color: 0xff9a1f, emissive: 0x6a2a00, roughness: 0.2 };
  private static readonly FAT = { color: 'rgba(255, 236, 170, 0.75)', min: 1, max: 3 };
  private static readonly CHASHU_MEAT = 0.86;
  private static readonly SPIRALS = {
    chashu: { color: 'rgba(255, 240, 225, 0.8)', width: 5, step: 0.25, spacing: 0.85 },
    naruto: { color: '#f0447a', width: 7, step: 0.2, spacing: 0.8 },
  };

  private readonly steam: Steam;

  /**
   * Crea el bol.
   *
   * @param textures Fábrica de texturas.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly textures: CanvasTextureFactory,
    private readonly random: SeededRandom,
  ) {
    super();
    this.steam = new Steam({ ...RamenBowl.STEAM, origin: { x: 0, y: RamenBowl.BROTH.y, z: 0 } }, random);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.steam.update(delta, elapsed);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildBowl();
    this.buildNoodles();
    this.buildChashu();
    this.buildEgg();
    this.buildGarnish();
    this.add(this.steam.create());
    this.root.position.copy(RamenBowl.POSITION);
  }

  /**
   * Tazón de paredes gruesas y caldo con textura.
   */
  private buildBowl(): void {
    const glaze = new MeshStandardMaterial({ map: this.own(this.bowlTexture()), roughness: 0.18 });
    this.add(new Mesh(RamenBowl.bowlGeometry(), glaze));
    const { radius, y } = RamenBowl.BROTH;
    const brothMap = this.own(this.brothTexture());
    const broth = new Mesh(
      new CircleGeometry(radius, GeometryDetail.Ring),
      new MeshStandardMaterial({ map: brothMap, emissiveMap: brothMap, emissive: 0x3a1c06, roughness: 0.12 }),
    );
    broth.rotation.x = -Math.PI / 2;
    this.add(broth, { x: 0, y, z: 0 });
  }

  /**
   * Fideos ondulados que asoman sobre el caldo, en una sola geometría.
   */
  private buildNoodles(): void {
    const { strands, radius } = RamenBowl.NOODLES;
    const pieces: BufferGeometry[] = [];
    for (let strand = 0; strand < strands; strand += 1) {
      pieces.push(new TubeGeometry(this.noodleCurve(), GeometryDetail.Medium, radius, GeometryDetail.Wire));
    }
    const material = new MeshStandardMaterial({ color: RamenBowl.COLORS.noodle, roughness: 0.35 });
    this.add(new Mesh(RamenBowl.merge(pieces), material));
  }

  /**
   * Trayectoria aleatoria de un fideo sobre la superficie del caldo.
   *
   * @returns Curva del fideo.
   */
  private noodleCurve(): CatmullRomCurve3 {
    const { points, reach, lift } = RamenBowl.NOODLES;
    const y = RamenBowl.BROTH.y + lift;
    const path: Vector3[] = [];
    let angle = this.random.range(0, Math.PI * 2);
    for (let point = 0; point < points; point += 1) {
      angle += this.random.range(-1, 1);
      const distance = this.random.range(0, reach);
      path.push(
        new Vector3(Math.cos(angle) * distance, y + this.random.range(0, lift), Math.sin(angle) * distance),
      );
    }
    return new CatmullRomCurve3(path);
  }

  /**
   * Dos rodajas de cerdo chashu apoyadas una sobre otra.
   */
  private buildChashu(): void {
    const { radius, thickness } = RamenBowl.CHASHU_SIZE;
    const map = this.own(this.chashuTexture());
    const material = new MeshStandardMaterial({ map, roughness: 0.45 });
    RamenBowl.CHASHU.forEach(({ x, z, tilt, turn }, index) => {
      const slice = new Mesh(new CylinderGeometry(radius, radius, thickness, GeometryDetail.High), material);
      slice.rotation.set(tilt, turn, 0);
      this.add(slice, { x, y: RamenBowl.BROTH.y + thickness * (index + 1), z });
    });
  }

  /**
   * Mitad de huevo marinado con la yema cremosa hacia arriba.
   */
  private buildEgg(): void {
    const { radius, scaleZ, yolk, x, z, lift } = RamenBowl.EGG;
    const white = new MeshStandardMaterial({ color: RamenBowl.COLORS.egg, roughness: 0.3 });
    const shell = new Mesh(RamenBowl.lowerHalf(radius), white);
    shell.scale.z = scaleZ;
    const y = RamenBowl.BROTH.y + lift;
    this.add(shell, { x, y, z });
    const cut = new Mesh(new CircleGeometry(radius, GeometryDetail.Medium), white);
    cut.rotation.x = -Math.PI / 2;
    cut.scale.y = scaleZ;
    this.add(cut, { x, y, z });
    const center = new Mesh(
      new CircleGeometry(yolk, GeometryDetail.Medium),
      new MeshStandardMaterial(RamenBowl.YOLK),
    );
    center.rotation.x = -Math.PI / 2;
    this.add(center, { x, y: y + lift / 2, z });
  }

  /**
   * Narutomaki, nori, menma y cebollín picado.
   */
  private buildGarnish(): void {
    const naruto = RamenBowl.NARUTO;
    const narutoMaterial = new MeshStandardMaterial({ map: this.own(this.narutoTexture()), roughness: 0.4 });
    const slice = new Mesh(
      new CylinderGeometry(naruto.radius, naruto.radius, naruto.thickness, GeometryDetail.Medium),
      narutoMaterial,
    );
    slice.rotation.x = naruto.tilt;
    this.add(slice, { x: naruto.x, y: RamenBowl.BROTH.y + naruto.thickness, z: naruto.z });
    const nori = RamenBowl.NORI;
    const sheet = new Mesh(
      new PlaneGeometry(nori.width, nori.height),
      new MeshStandardMaterial({ color: RamenBowl.COLORS.nori, roughness: 0.6, side: DoubleSide }),
    );
    sheet.rotation.x = nori.tilt;
    this.add(sheet, { x: nori.x, y: RamenBowl.BROTH.y + nori.height / 2, z: nori.z });
    this.buildMenma();
    this.buildNegi();
  }

  /**
   * Tiras de brote de bambú.
   */
  private buildMenma(): void {
    const { count, width, height, length, x, z } = RamenBowl.MENMA;
    const pieces: BufferGeometry[] = [];
    for (let piece = 0; piece < count; piece += 1) {
      const geometry = new BoxGeometry(width, height, length);
      geometry.rotateY(this.random.range(-1, 1));
      geometry.translate(x + piece * width, RamenBowl.BROTH.y + height, z + this.random.range(-width, width));
      pieces.push(geometry);
    }
    const material = new MeshStandardMaterial({ color: RamenBowl.COLORS.menma, roughness: 0.5 });
    this.add(new Mesh(RamenBowl.merge(pieces), material));
  }

  /**
   * Rodajitas de cebollín esparcidas.
   */
  private buildNegi(): void {
    const { count, radius, height, spread, x, z } = RamenBowl.NEGI;
    const pieces: BufferGeometry[] = [];
    for (let piece = 0; piece < count; piece += 1) {
      const geometry = new CylinderGeometry(radius, radius, height, GeometryDetail.Thin);
      geometry.translate(
        x + this.random.range(-spread, spread),
        RamenBowl.BROTH.y + RamenBowl.NOODLES.lift * 2,
        z + this.random.range(-spread, spread),
      );
      pieces.push(geometry);
    }
    const material = new MeshStandardMaterial({
      color: RamenBowl.COLORS.negi,
      emissive: 0x0d2a06,
      roughness: 0.4,
    });
    this.add(new Mesh(RamenBowl.merge(pieces), material));
  }

  /**
   * Esmalte: exterior negro con banda roja y filete dorado; interior rojo laca.
   *
   * @returns Textura del tazón (v = 0 pie exterior, v = 1 fondo interior).
   */
  private bowlTexture(): Texture {
    const size = RamenBowl.CANVAS.bowl;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = '#0d0c10';
      context.fillRect(0, 0, size, size);
      RamenBowl.GLAZE_BANDS.forEach(({ color, from, height }) => {
        context.fillStyle = color;
        context.fillRect(0, size * from, size, size * height);
      });
    });
  }

  /**
   * Caldo tonkotsu: centro dorado, borde más oscuro y gotas de grasa brillantes.
   *
   * @returns Textura del caldo.
   */
  private brothTexture(): Texture {
    const size = RamenBowl.CANVAS.size;
    const half = size / 2;
    return this.textures.paint(size, size, (context) => {
      const gradient = context.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, '#e9b35f');
      gradient.addColorStop(1, '#8a4d1c');
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      this.fatDrops(context, size);
    });
  }

  /**
   * Gotitas de grasa brillantes flotando en el caldo.
   *
   * @param context Contexto 2D.
   * @param size Tamaño del canvas.
   */
  private fatDrops(context: CanvasRenderingContext2D, size: number): void {
    const { color, min, max } = RamenBowl.FAT;
    context.fillStyle = color;
    for (let drop = 0; drop < size / 2; drop += 1) {
      context.beginPath();
      context.arc(
        this.random.range(0, size),
        this.random.range(0, size),
        this.random.range(min, max),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  /**
   * Chashu: borde tostado, carne rosada y vetas de grasa en espiral.
   *
   * @returns Textura radial de la rodaja.
   */
  private chashuTexture(): Texture {
    const size = RamenBowl.CANVAS.size;
    const half = size / 2;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = '#6b3217';
      context.fillRect(0, 0, size, size);
      context.fillStyle = '#d98b77';
      context.beginPath();
      context.arc(half, half, half * RamenBowl.CHASHU_MEAT, 0, Math.PI * 2);
      context.fill();
      RamenBowl.spiral(context, half, RamenBowl.SPIRALS.chashu);
    });
  }

  /**
   * Narutomaki: pasta de pescado blanca con espiral rosa.
   *
   * @returns Textura radial de la rodaja.
   */
  private narutoTexture(): Texture {
    const size = RamenBowl.CANVAS.size;
    const half = size / 2;
    return this.textures.paint(size, size, (context) => {
      context.fillStyle = '#fbf6f2';
      context.fillRect(0, 0, size, size);
      RamenBowl.spiral(context, half, RamenBowl.SPIRALS.naruto);
    });
  }

  /**
   * Espiral que se abre desde el centro (vetas del chashu, remolino del naruto).
   *
   * @param context Contexto 2D.
   * @param half Radio del canvas.
   * @param spiral Color, grosor, giro por paso y separación entre vueltas.
   * @param spiral.color Color del trazo.
   * @param spiral.width Grosor del trazo.
   * @param spiral.step Giro por paso, en radianes.
   * @param spiral.spacing Separación entre vueltas, en píxeles por paso.
   */
  private static spiral(
    context: CanvasRenderingContext2D,
    half: number,
    spiral: { color: string; width: number; step: number; spacing: number },
  ): void {
    context.strokeStyle = spiral.color;
    context.lineWidth = spiral.width;
    context.beginPath();
    for (let turn = 0; turn < half; turn += 1) {
      const angle = turn * spiral.step;
      const radius = turn * spiral.spacing;
      context.lineTo(half + Math.cos(angle) * radius, half + Math.sin(angle) * radius);
    }
    context.stroke();
  }

  /**
   * Media esfera inferior (la clara del huevo cortado).
   *
   * @param radius Radio.
   * @returns Geometría.
   */
  private static lowerHalf(radius: number): SphereGeometry {
    const half = Math.PI / 2;
    return new SphereGeometry(radius, GeometryDetail.Medium, GeometryDetail.Thin, 0, Math.PI * 2, half, half);
  }

  /**
   * Perfil de un tazón con grosor: sube por fuera, dobla en el borde y baja por dentro.
   *
   * @returns Geometría de revolución.
   */
  private static bowlGeometry(): LatheGeometry {
    const { radius, foot, height, wall, segments } = RamenBowl.BOWL;
    const profile: Vector2[] = [];
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      profile.push(new Vector2(foot + (radius - foot) * Math.sin((t * Math.PI) / 2), t * height));
    }
    for (let step = segments; step >= 0; step -= 1) {
      const t = step / segments;
      const inner = foot - wall + (radius - foot) * Math.sin((t * Math.PI) / 2);
      profile.push(new Vector2(Math.max(inner, 0), wall + t * (height - wall)));
    }
    return new LatheGeometry(profile, segments * 3);
  }

  /**
   * Une piezas pequeñas en una sola geometría (un solo draw call) y libera las originales.
   *
   * @param pieces Geometrías a unir.
   * @returns Geometría combinada.
   */
  private static merge(pieces: BufferGeometry[]): BufferGeometry {
    const merged = mergeGeometries(pieces);
    pieces.forEach((piece) => {
      piece.dispose();
    });
    return merged;
  }
}
