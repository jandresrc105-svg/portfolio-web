import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type Texture,
} from 'three';

/**
 * Una cortina metálica enrollable (patrón Builder): la caja donde se enrolla, la lámina corrugada que se
 * desenrolla hasta la barra de abajo y la barra misma. Se arma de frente (+z) en su propio grupo, centrada en x y
 * con las alturas del mundo; quien la usa ubica y gira el grupo. La lámina se estira desde la caja hasta la
 * barra y la textura repite las láminas para que no se deformen.
 */
export class RollShutter {
  private static readonly SLAT = 0.07;
  private static readonly CURTAIN = { color: 0xa7acb4, roughness: 0.55, metalness: 0.5 };
  private static readonly HOUSING = { height: 0.16, depth: 0.2, color: 0x5a5f69 };
  private static readonly BAR = { height: 0.05, depth: 0.05, color: 0x3d4149 };
  private static readonly MIN_SCALE = 0.001;

  /** Grupo de la cortina, para ubicarlo y girarlo. */
  public readonly group = new Group();
  /** Barra de abajo (lo que cuelga de ella baja con la cortina). */
  public readonly bar = new Group();

  private readonly panel = new Group();

  /**
   * Arma la cortina.
   *
   * @param map Textura corrugada (propia de esta cortina: su repetición cambia al bajar).
   * @param size Medidas.
   * @param size.width Ancho.
   * @param size.top Altura de la caja (donde está enrollada).
   * @param size.bottom Altura donde se apoya cerrada.
   */
  public constructor(
    private readonly map: Texture,
    private readonly size: { readonly width: number; readonly top: number; readonly bottom: number },
  ) {
    this.buildHousing();
    this.buildCurtain();
    this.buildBar();
  }

  /**
   * Altura de la barra de abajo según cuánto bajó.
   *
   * @param pulled 0 = enrollada, 1 = cerrada.
   * @returns Altura.
   */
  public barHeight(pulled: number): number {
    const { top, bottom } = this.size;
    return top + (bottom - top) * pulled;
  }

  /**
   * Baja o sube la cortina.
   *
   * @param pulled 0 = enrollada, 1 = cerrada.
   * @returns Altura de la barra de abajo.
   */
  public setPulled(pulled: number): number {
    const barY = this.barHeight(pulled);
    const drop = Math.max(this.size.top - barY, RollShutter.MIN_SCALE);
    this.panel.scale.y = drop;
    this.map.repeat.set(1, drop / RollShutter.SLAT);
    this.bar.position.y = barY;
    return barY;
  }

  /**
   * Caja donde se enrolla.
   */
  private buildHousing(): void {
    const { height, depth, color } = RollShutter.HOUSING;
    const metal = new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 });
    const housing = new Mesh(new BoxGeometry(this.size.width, height, depth), metal);
    housing.position.y = this.size.top + height / 2;
    this.group.add(housing);
  }

  /**
   * Lámina corrugada que cuelga de la caja.
   */
  private buildCurtain(): void {
    this.map.rotation = Math.PI / 2;
    const material = new MeshStandardMaterial({
      ...RollShutter.CURTAIN,
      map: this.map,
      bumpMap: this.map,
      side: DoubleSide,
    });
    this.panel.add(new Mesh(new PlaneGeometry(this.size.width, 1).translate(0, -1 / 2, 0), material));
    this.panel.position.y = this.size.top;
    this.group.add(this.panel);
  }

  /**
   * Barra de abajo.
   */
  private buildBar(): void {
    const { height, depth, color } = RollShutter.BAR;
    const metal = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6 });
    this.bar.add(new Mesh(new BoxGeometry(this.size.width, height, depth), metal));
    this.group.add(this.bar);
  }
}
