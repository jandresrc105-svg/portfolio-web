import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Vector3Like,
} from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { MaterialLibrary } from '../MaterialLibrary';
import { Steam } from './Steam';

/**
 * Cocina del puesto: fogones con llama azul, olla de caldo humeante, cazo de fideos, torre de tazones
 * y botellas de salsa y sake en la repisa. Llena el interior de detalles que se ven detrás del cocinero.
 */
export class KitchenProps extends SceneObject implements Updatable {
  private static readonly TOP = 0.92;
  private static readonly BURNERS = [
    { x: -0.55, z: -1.25, radius: 0.16 },
    { x: 0.25, z: -1.22, radius: 0.12 },
  ];
  private static readonly BURNER = { width: 0.42, height: 0.05, depth: 0.4, tube: 0.008 };
  private static readonly STOCKPOT = { radius: 0.2, height: 0.34, x: -0.55, z: -1.25 };
  private static readonly SAUCEPAN = { radius: 0.13, height: 0.14, x: 0.25, z: -1.22, handle: 0.22 };
  private static readonly RIM = { tube: 0.012, taper: 0.96 };
  private static readonly FILL = { broth: 0.9, inset: 0.94, grip: 0.85 };
  private static readonly BOWL_PROFILE = { foot: 0.45 };
  private static readonly BOTTLE_PROFILE = { neck: 0.35, shoulder: 0.6, collar: 0.78 };
  private static readonly BOWLS = { count: 4, radius: 0.13, height: 0.075, gap: 0.045, x: 1.25, z: -1.3 };
  private static readonly SHELF_TOP = { y: 1.745, z: -1.5 };
  private static readonly BOTTLES = [
    { x: -1.75, color: 0x2a1208, height: 0.24, radius: 0.04 },
    { x: -1.6, color: 0x2a1208, height: 0.24, radius: 0.04 },
    { x: -1.25, color: 0x1f6b3a, height: 0.32, radius: 0.045 },
    { x: -1.1, color: 0xe8e2d0, height: 0.2, radius: 0.05 },
    { x: 1.3, color: 0x7a1016, height: 0.28, radius: 0.042 },
    { x: 1.48, color: 0x1f6b3a, height: 0.32, radius: 0.045 },
    { x: 1.68, color: 0xd9a441, height: 0.18, radius: 0.055 },
  ];
  private static readonly FLAME = { color: 0x3a7bff, glow: 2.6, flicker: 0.35, speed: 13, beat: 0.37 };
  private static readonly BROTH = { color: 0x9a5a22, emissive: 0x3a1a05 };
  private static readonly STEAM = {
    count: 60,
    height: 1.25,
    speed: 0.16,
    spread: 0.18,
    size: 0.3,
    opacity: 0.13,
  };
  private static readonly SEGMENTS = 10;

  private readonly flame = new MeshBasicMaterial({ color: KitchenProps.FLAME.color });
  private readonly steam: Steam;

  /**
   * Crea la cocina.
   *
   * @param materials Materiales compartidos.
   * @param random Generador determinista.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    random: SeededRandom,
  ) {
    super();
    const { x, z, height } = KitchenProps.STOCKPOT;
    this.steam = new Steam({ ...KitchenProps.STEAM, origin: { x, y: KitchenProps.TOP + height, z } }, random);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    const { color, glow, flicker, speed } = KitchenProps.FLAME;
    const wave = Math.sin(elapsed * speed) * Math.sin(elapsed * speed * KitchenProps.FLAME.beat);
    this.flame.color.set(color).multiplyScalar(glow * (1 - flicker + flicker * wave * wave));
    this.steam.update(delta, elapsed);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildBurners();
    this.buildStockpot();
    this.buildSaucepan();
    this.buildBowls();
    this.buildBottles();
    this.add(this.steam.create());
    this.settle(this.steam.root);
  }

  /**
   * Fogones con anillo de llama azul titilante.
   */
  private buildBurners(): void {
    const { width, height, depth, tube } = KitchenProps.BURNER;
    KitchenProps.BURNERS.forEach(({ x, z, radius }) => {
      this.part(new BoxGeometry(width, height, depth), this.materials.darkMetal, {
        x,
        y: KitchenProps.TOP + height / 2,
        z,
      });
      const ring = this.part(
        new TorusGeometry(radius, tube, GeometryDetail.Thin, GeometryDetail.High),
        this.flame,
        {
          x,
          y: KitchenProps.TOP + height,
          z,
        },
      );
      ring.rotation.x = Math.PI / 2;
    });
  }

  /**
   * Olla alta de caldo con borde grueso y el caldo a la vista.
   */
  private buildStockpot(): void {
    const { radius, height, x, z } = KitchenProps.STOCKPOT;
    const base = KitchenProps.TOP + KitchenProps.BURNER.height;
    this.pot({ radius, height, x, z, y: base });
    const { color, emissive } = KitchenProps.BROTH;
    const broth = this.part(
      new CircleGeometry(radius * KitchenProps.FILL.inset, GeometryDetail.High),
      new MeshStandardMaterial({ color, emissive, roughness: 0.15 }),
      { x, y: base + height * KitchenProps.FILL.broth, z },
    );
    broth.rotation.x = -Math.PI / 2;
  }

  /**
   * Cazo con mango largo para los fideos.
   */
  private buildSaucepan(): void {
    const { radius, height, x, z, handle } = KitchenProps.SAUCEPAN;
    const base = KitchenProps.TOP + KitchenProps.BURNER.height;
    this.pot({ radius, height, x, z, y: base });
    const grip = this.part(
      new BoxGeometry(handle, KitchenProps.RIM.tube * 2, KitchenProps.RIM.tube * 3),
      this.materials.woodDark,
      {
        x: x + radius + handle / 2,
        y: base + height * KitchenProps.FILL.grip,
        z,
      },
    );
    grip.rotation.z = 0.12;
  }

  /**
   * Olla de acero: cilindro abierto con borde enrollado.
   *
   * @param pot Medidas y posición de la base.
   * @param pot.radius Radio.
   * @param pot.height Alto.
   * @param pot.x Centro x.
   * @param pot.y Altura de la base.
   * @param pot.z Centro z.
   */
  private pot(pot: { radius: number; height: number; x: number; y: number; z: number }): void {
    const steel = this.materials.metal;
    const { tube, taper } = KitchenProps.RIM;
    const walls = new CylinderGeometry(
      pot.radius,
      pot.radius * taper,
      pot.height,
      GeometryDetail.High,
      1,
      true,
    );
    this.part(walls, steel, { x: pot.x, y: pot.y + pot.height / 2, z: pot.z });
    const bottom = new CircleGeometry(pot.radius, GeometryDetail.High).rotateX(-Math.PI / 2);
    this.part(bottom, this.materials.darkMetal, { x: pot.x, y: pot.y + tube, z: pot.z });
    const rim = new TorusGeometry(pot.radius, tube, GeometryDetail.Thin, GeometryDetail.High).rotateX(
      Math.PI / 2,
    );
    this.part(rim, steel, { x: pot.x, y: pot.y + pot.height, z: pot.z });
  }

  /**
   * Torre de tazones limpios esperando el próximo pedido.
   */
  private buildBowls(): void {
    const { count, radius, height, gap, x, z } = KitchenProps.BOWLS;
    const geometry = KitchenProps.bowl(radius, height);
    const glaze = new MeshStandardMaterial({ color: 0x14131a, roughness: 0.2 });
    for (let bowl = 0; bowl < count; bowl += 1) {
      this.part(geometry.clone(), glaze, { x, y: KitchenProps.TOP + bowl * gap, z });
    }
    geometry.dispose();
  }

  /**
   * Botellas de salsa de soya, sake y aceite sobre la repisa.
   */
  private buildBottles(): void {
    const { y, z } = KitchenProps.SHELF_TOP;
    KitchenProps.BOTTLES.forEach(({ x, color, height, radius }) => {
      const glass = new MeshStandardMaterial({ color: new Color(color), roughness: 0.12, metalness: 0.2 });
      this.part(KitchenProps.bottle(radius, height), glass, { x, y, z });
    });
  }

  /**
   * Agrega una pieza.
   *
   * @param geometry Geometría.
   * @param material Material.
   * @param position Posición.
   * @returns Malla creada.
   */
  private part(geometry: BufferGeometry, material: Material, position: Vector3Like): Mesh {
    return this.add(new Mesh(geometry, material), position);
  }

  /**
   * Perfil de un tazón simple.
   *
   * @param radius Radio del borde.
   * @param height Alto.
   * @returns Geometría de revolución.
   */
  private static bowl(radius: number, height: number): LatheGeometry {
    const profile: Vector2[] = [];
    for (let step = 0; step <= KitchenProps.SEGMENTS; step += 1) {
      const t = step / KitchenProps.SEGMENTS;
      const { foot } = KitchenProps.BOWL_PROFILE;
      profile.push(new Vector2(radius * (foot + (1 - foot) * Math.sin((t * Math.PI) / 2)), t * height));
    }
    return new LatheGeometry(profile, GeometryDetail.High);
  }

  /**
   * Perfil de una botella: cuerpo, hombro y cuello.
   *
   * @param radius Radio del cuerpo.
   * @param height Alto total.
   * @returns Geometría de revolución.
   */
  private static bottle(radius: number, height: number): LatheGeometry {
    const { neck: neckRatio, shoulder, collar } = KitchenProps.BOTTLE_PROFILE;
    const neck = radius * neckRatio;
    const profile = [
      new Vector2(0, 0),
      new Vector2(radius, 0),
      new Vector2(radius, height * shoulder),
      new Vector2(neck, height * collar),
      new Vector2(neck, height),
      new Vector2(0, height),
    ];
    return new LatheGeometry(profile, GeometryDetail.Medium);
  }
}
