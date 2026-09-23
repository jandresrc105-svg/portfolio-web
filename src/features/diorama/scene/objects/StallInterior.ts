import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
} from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Powerable } from '../../models/Powerable';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Interior del puesto: luz cálida, bombillo colgante, repisa y tablillas de menú.
 */
export class StallInterior extends SceneObject implements Powerable {
  private static readonly WARM = 0xffa057;
  private static readonly MENU_LIGHT = 0xffffff;
  private static readonly OFF_GLOW = 0.05;
  private static readonly LIGHT = { intensity: 16, distance: 7.5, x: 0, y: 2.25, z: -0.35 };
  private static readonly BULB = { radius: 0.07, glow: 9, x: 0, y: 2.2, z: 0.45 };
  private static readonly SHADE = { radius: 0.2, height: 0.16, y: 2.32 };
  private static readonly SHELF = { width: 4, height: 0.05, depth: 0.28, y: 1.72, z: -1.5 };
  private static readonly MENU = { width: 0.42, height: 0.62, y: 2.25, z: -1.61, glow: 0.3 };
  private static readonly MENU_ITEMS = [
    { dish: '醤油', price: '700' },
    { dish: '味噌', price: '800' },
    { dish: '豚骨', price: '900' },
    { dish: '塩', price: '750' },
    { dish: '餃子', price: '400' },
  ];
  private static readonly MENU_SPACING = 0.62;
  private static readonly MENU_LAYOUT = { firstGlyph: 58, glyphStep: 50, priceMargin: 16 };
  private static readonly MENU_CANVAS = { width: 128, height: 192 };

  private readonly light = new PointLight(StallInterior.WARM, 0, StallInterior.LIGHT.distance, 2);
  private readonly bulb = new MeshBasicMaterial({ color: StallInterior.WARM });
  private readonly menus: MeshStandardMaterial[] = [];

  /**
   * Crea el interior.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas para las tablillas.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly textures: CanvasTextureFactory,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.light.intensity = StallInterior.LIGHT.intensity * level;
    this.bulb.color
      .set(StallInterior.WARM)
      .multiplyScalar(Math.max(level * StallInterior.BULB.glow, StallInterior.OFF_GLOW));
    this.menus.forEach((menu) => {
      menu.emissiveIntensity = level * StallInterior.MENU.glow;
    });
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { x, y, z } = StallInterior.LIGHT;
    this.add(this.light, { x, y, z });
    this.buildLamp();
    const shelf = StallInterior.SHELF;
    this.add(new Mesh(new BoxGeometry(shelf.width, shelf.height, shelf.depth), this.materials.woodLight), {
      x: 0,
      y: shelf.y,
      z: shelf.z,
    });
    StallInterior.MENU_ITEMS.forEach((item, index) => {
      this.buildMenu(item, index);
    });
    this.setPower(0);
  }

  /**
   * Bombillo desnudo con pantalla cónica sobre la barra.
   */
  private buildLamp(): void {
    const { radius, x, y, z } = StallInterior.BULB;
    this.add(new Mesh(new SphereGeometry(radius), this.bulb), { x, y, z });
    const shade = StallInterior.SHADE;
    const cone = new Mesh(
      new ConeGeometry(shade.radius, shade.height, GeometryDetail.High, 1, true),
      this.materials.darkMetal,
    );
    this.add(cone, { x, y: shade.y, z });
  }

  /**
   * Tablilla de madera con el nombre del plato y su precio.
   *
   * @param item Plato del menú.
   * @param item.dish Nombre del plato.
   * @param item.price Precio.
   * @param index Posición en la fila.
   */
  private buildMenu(item: { dish: string; price: string }, index: number): void {
    const { width, height, y, z } = StallInterior.MENU;
    const map = this.own(this.menuTexture(item.dish, item.price));
    const material = new MeshStandardMaterial({
      map,
      emissiveMap: map,
      emissive: new Color(StallInterior.MENU_LIGHT),
      roughness: 0.8,
    });
    this.menus.push(material);
    const offset = (index - (StallInterior.MENU_ITEMS.length - 1) / 2) * StallInterior.MENU_SPACING;
    this.add(new Mesh(new PlaneGeometry(width, height), material), { x: offset, y, z });
  }

  /**
   * Dibuja la tablilla: madera clara, plato en vertical y precio abajo.
   *
   * @param dish Nombre del plato.
   * @param price Precio.
   * @returns Textura de la tablilla.
   */
  private menuTexture(dish: string, price: string): ReturnType<CanvasTextureFactory['paint']> {
    const { width, height } = StallInterior.MENU_CANVAS;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = '#d9b98a';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#1d140c';
      context.textAlign = 'center';
      const { firstGlyph, glyphStep, priceMargin } = StallInterior.MENU_LAYOUT;
      context.font = `900 44px ${CanvasTextureFactory.JAPANESE_FONT}`;
      Array.from(dish).forEach((glyph, index) => {
        context.fillText(glyph, width / 2, firstGlyph + index * glyphStep);
      });
      context.font = `700 26px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText(`¥${price}`, width / 2, height - priceMargin);
    });
  }
}
