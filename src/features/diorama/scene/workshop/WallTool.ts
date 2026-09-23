import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterialParameters,
  type Object3D,
  type Texture,
  type Vector3Like,
} from 'three';
import type { ToolBounds } from '../../models/ToolBounds';
import type { ToolId } from '../../models/ToolId';
import type { ToolOutline } from '../../models/ToolOutline';
import type { ToolWallState } from '../../models/ToolWallState';
import { ToolPalette } from './ToolPalette';
import { ToolShapes } from './ToolShapes';

/**
 * Herramienta colgada en la pared (patrón Template Method). La subclase arma su forma en {@link WallTool.body}
 * (en el plano xy, colgada, con el origen en su gancho), dice qué caja ocupa y cómo es su silueta pintada, y
 * puede animar su mecanismo en {@link WallTool.pose}. La base la lleva de su gancho a la mano en un arco con
 * una vuelta completa, la deja flotando con un vaivén suave y la resalta.
 */
export abstract class WallTool {
  protected static readonly PALETTE = new ToolPalette();
  protected static readonly SHAPES = new ToolShapes();

  private static readonly FLIGHT = {
    rate: 1.4,
    lift: 0.08,
    tilt: -0.22,
    sway: 0.12,
    swayRate: 1.1,
    bob: 0.008,
    bobRate: 1.7,
  };
  private static readonly ZOOM = 1.6;
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };
  private static readonly HIT = { depth: 0.05, margin: 0.012 };
  private static readonly HOOKS = [{ x: 0, y: 0 }];

  public readonly root = new Group();
  public readonly hitArea = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ visible: false }));

  protected readonly body = new Group();
  protected level = 0;

  private readonly owned: Texture[] = [];
  private readonly finishes = new Map<MeshStandardMaterialParameters, MeshStandardMaterial>();
  private readonly hang = new Vector3();
  private readonly held = new Vector3();
  private blend = 0;
  private goal = 0;

  /**
   * Crea la herramienta.
   *
   * @param id Herramienta (id de su control).
   */
  public constructor(public readonly id: ToolId) {}

  /**
   * Construye la herramienta y su zona de clic.
   *
   * @returns Raíz de la herramienta.
   */
  public build(): Group {
    this.shape();
    const { x, y, width, height } = this.bounds();
    const { depth, margin } = WallTool.HIT;
    this.hitArea.scale.set(width + margin, height + margin, depth);
    this.hitArea.position.set(x, y, 0);
    this.root.add(this.body, this.hitArea);
    return this.root;
  }

  /**
   * Clavijas del tablero en las que se apoya, respecto a su origen.
   *
   * @returns Puntos de las clavijas.
   */
  public hooks(): readonly { x: number; y: number }[] {
    return WallTool.HOOKS;
  }

  /**
   * Fija el gancho y el punto donde flota al tomarla.
   *
   * @param hang Posición colgada.
   * @param held Posición en la mano.
   */
  public place(hang: Vector3Like, held: Vector3Like): void {
    this.hang.copy(hang);
    this.held.copy(held);
    this.root.position.copy(hang);
  }

  /**
   * Toma o cuelga la herramienta (la animación sigue en {@link WallTool.update}).
   *
   * @param held Si queda en la mano.
   */
  public setHeld(held: boolean): void {
    this.goal = held ? 1 : 0;
  }

  /**
   * Avanza el vuelo entre el gancho y la mano, y el vaivén mientras flota.
   *
   * @param delta Segundos desde el frame anterior.
   * @param elapsed Segundos desde el inicio.
   */
  public update(delta: number, elapsed: number): void {
    if (this.blend === 0 && this.goal === 0) {
      return;
    }
    const step = delta * WallTool.FLIGHT.rate;
    this.blend =
      this.goal > this.blend
        ? Math.min(this.blend + step, this.goal)
        : Math.max(this.blend - step, this.goal);
    const eased = this.blend * this.blend * (3 - 2 * this.blend);
    this.fly(eased, elapsed);
  }

  /**
   * Resalta la herramienta señalada.
   *
   * @param active Si está señalada.
   */
  public highlight(active: boolean): void {
    const { color, strength } = WallTool.HIGHLIGHT;
    this.finishes.forEach((material) => {
      material.emissive.set(color).multiplyScalar(active ? strength : 0);
    });
  }

  /**
   * Fija el brillo general (pantallas y luces propias).
   *
   * @param level Brillo [0, 1].
   */
  public setPower(level: number): void {
    this.level = level;
  }

  /**
   * Libera las texturas propias (las geometrías y materiales los libera la pieza).
   */
  public dispose(): void {
    this.owned.splice(0).forEach((texture) => {
      texture.dispose();
    });
  }

  /**
   * Inspección de la herramienta tomada: por defecto gira sobre su eje vertical.
   *
   * @param state Ángulo de inspección y apertura del mecanismo.
   */
  public pose(state: ToolWallState): void {
    this.body.rotation.y = state.turn;
  }

  /**
   * Silueta pintada en el tablero, en el espacio de la herramienta colgada.
   *
   * @returns Formas de la silueta.
   */
  public abstract outline(): readonly ToolOutline[];

  /**
   * Arma la forma de la herramienta dentro de {@link WallTool.body}.
   */
  protected abstract shape(): void;

  /**
   * Caja que ocupa la herramienta colgada.
   *
   * @returns Caja.
   */
  protected abstract bounds(): ToolBounds;

  /**
   * Material de la herramienta con un acabado (uno por acabado, para resaltarla sola).
   *
   * @param style Acabado de {@link ToolPalette}.
   * @returns Material.
   */
  protected finish(style: MeshStandardMaterialParameters): MeshStandardMaterial {
    let material = this.finishes.get(style);
    if (!material) {
      material = new MeshStandardMaterial(style);
      this.finishes.set(style, material);
    }
    return material;
  }

  /**
   * Registra una textura propia para liberarla con la herramienta.
   *
   * @param texture Textura.
   * @returns La misma textura.
   */
  protected keep<T extends Texture>(texture: T): T {
    this.owned.push(texture);
    return texture;
  }

  /**
   * Agrega una malla a la herramienta.
   *
   * @param geometry Geometría.
   * @param style Acabado.
   * @param parent Grupo donde va (por defecto el cuerpo).
   * @returns Malla, para posicionarla.
   */
  protected part(geometry: BufferGeometry, style: MeshStandardMaterialParameters, parent?: Object3D): Mesh {
    const mesh = new Mesh(geometry, this.finish(style));
    (parent ?? this.body).add(mesh);
    return mesh;
  }

  /**
   * Coloca la herramienta en un punto del vuelo.
   *
   * @param eased Avance suavizado [0, 1] (0 = colgada, 1 = en la mano).
   * @param elapsed Segundos desde el inicio (vaivén).
   */
  private fly(eased: number, elapsed: number): void {
    const { lift, tilt, sway, swayRate, bob, bobRate } = WallTool.FLIGHT;
    this.root.position.lerpVectors(this.hang, this.held, eased);
    this.root.scale.setScalar(1 + (WallTool.ZOOM - 1) * eased);
    this.root.position.y += Math.sin(Math.PI * eased) * lift + Math.sin(elapsed * bobRate) * bob * eased;
    this.root.rotation.set(
      tilt * eased,
      eased * Math.PI * 2 + Math.sin(elapsed * swayRate) * sway * eased,
      0,
    );
  }
}
