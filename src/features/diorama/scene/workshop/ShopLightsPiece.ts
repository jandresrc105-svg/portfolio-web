import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import { ShopLightsControl } from '../../models/ShopLightsControl';
import type { ShopLightsState } from '../../models/ShopLightsState';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import type { WorkshopLayout } from './WorkshopLayout';
import { CeilingFixtures } from './lights/CeilingFixtures';
import { LedStrip } from './lights/LedStrip';
import { OpenSign } from './lights/OpenSign';
import { PlasmaGlobe } from './lights/PlasmaGlobe';
import { SmoothLevel } from './lights/SmoothLevel';
import { StrikePattern } from './lights/StrikePattern';
import { SwitchPanel } from './SwitchPanel';

/**
 * Luces y ambiente del taller (Composite de sub-piezas): tablero de interruptores en la pared derecha,
 * regletas del techo con la luz del local, tira LED del banco, letrero OPEN en la entrada y la bola de
 * plasma sobre el huacal de la calle. Recibe el estado del service y hace todos los cambios con fundidos
 * (los tubos arrancan con destellos).
 */
export class ShopLightsPiece extends SceneObject implements Updatable, Powerable {
  private static readonly RATE = { ceiling: 7, bench: 9 };
  private static readonly DIMMER_FLOOR = 0.08;

  private readonly layout: WorkshopLayout;
  private readonly panel: SwitchPanel;
  private readonly fixtures: CeilingFixtures;
  private readonly strip: LedStrip;
  private readonly sign: OpenSign;
  private readonly globe = new PlasmaGlobe();
  private readonly ceiling = new SmoothLevel(1, ShopLightsPiece.RATE.ceiling);
  private readonly dimmer = new SmoothLevel(1, ShopLightsPiece.RATE.ceiling);
  private readonly bench = new SmoothLevel(1, ShopLightsPiece.RATE.bench);
  private readonly strike = new StrikePattern();
  private ceilingOn = true;
  private level = 0;

  /**
   * Crea la pieza.
   *
   * @param context Materiales, texturas y ubicación del taller.
   */
  public constructor(private readonly context: WorkshopContext) {
    super();
    const { materials, textures, layout } = context;
    this.layout = layout;
    this.panel = new SwitchPanel(materials, textures);
    this.fixtures = new CeilingFixtures(materials.darkMetal);
    this.strip = new LedStrip(materials.metal, layout.pegboardZ());
    this.sign = new OpenSign(textures, materials.cable);
  }

  /**
   * Controles que reciben el puntero: palancas, dimmer y la bola de plasma.
   *
   * @returns Controles.
   */
  public controls(): WorkshopControl[] {
    return [...this.panel.controls(), { id: ShopLightsControl.Globe, hitArea: this.globe.hitArea }];
  }

  /**
   * Lleva la escena al estado de las luces.
   *
   * @param state Estado.
   */
  public show(state: ShopLightsState): void {
    this.panel.show(state);
    if (state.ceiling && !this.ceilingOn) {
      this.strike.start();
    }
    this.ceilingOn = state.ceiling;
    this.ceiling.set(state.ceiling ? 1 : 0);
    this.dimmer.set(ShopLightsPiece.DIMMER_FLOOR + (1 - ShopLightsPiece.DIMMER_FLOOR) * state.dimmer);
    this.bench.set(state.bench ? 1 : 0);
    this.sign.setOn(state.sign);
    this.globe.setOn(state.plasma);
  }

  /**
   * Resalta el control señalado; la bola de plasma, además, junta sus filamentos hacia el puntero.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.panel.highlight(id);
    this.globe.setTouched(id === ShopLightsControl.Globe);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    const ceiling = this.ceiling.step(delta) * this.dimmer.step(delta);
    const strike = this.ceilingOn ? this.strike.step(delta) : 1;
    this.fixtures.apply(ceiling * strike * this.level);
    this.strip.apply(this.bench.step(delta) * this.level);
    this.panel.update(delta, this.level);
    this.sign.update(delta, this.level);
    this.globe.update(delta, elapsed, this.level);
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { materials } = this.context;
    const panel = this.panel.build();
    const sign = this.sign.build();
    this.own(panel.texture);
    this.own(sign.texture);
    this.root.add(
      panel.group,
      this.fixtures.build(),
      this.strip.build(),
      sign.group,
      this.globe.build(materials.woodLight, materials.metal),
    );
    this.layout.place(this.root);
    this.update(0, 0);
  }
}
