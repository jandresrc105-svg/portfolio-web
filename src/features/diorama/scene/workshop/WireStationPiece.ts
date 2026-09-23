import { MeshStandardMaterial, Vector3 } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import { WireStep } from '../../models/WireStep';
import type { Powerable } from '../../models/Powerable';
import type { WireStationSource } from '../../models/WireStationSource';
import type { WireStationState } from '../../models/WireStationState';
import type { WorkshopContext } from '../../models/WorkshopContext';
import type { WorkshopControl } from '../../models/WorkshopControl';
import { WireStationService } from '../../services/WireStationService';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { WorkshopLayout } from './WorkshopLayout';
import { SolderSmoke } from './wire/SolderSmoke';
import { SolderingIron } from './wire/SolderingIron';
import { StepPanel } from './wire/StepPanel';
import { TerminalBlock } from './wire/TerminalBlock';
import { WireLead } from './wire/WireLead';
import { WireReel } from './wire/WireReel';
import { CableStripper } from './wire/CableStripper';
import { WireTable } from './wire/WireTable';

/**
 * Estación de cableado del taller, contra la pared derecha: la mesita con el carrete de cable rojo, el tramo
 * cortado, el pelacables, el cautín en su base, la bornera de tornillo y el panel de los cinco pasos. En cada
 * frame hace avanzar la estación (el reloj de sus animaciones) y lleva su estado a las piezas: el cable sale del
 * carrete, el aislante se desliza, los hilos se abren, se tuercen y se platean, el tornillo aprieta y el LED
 * marca continuidad.
 */
export class WireStationPiece extends SceneObject implements Updatable, Powerable {
  private static readonly LINE = { y: WireTable.TOP + WireLead.RADIUS, z: 0.14 };
  private static readonly CABLE = { exit: 1.04, length: 0.17, gap: 0.012, insert: 0.1, clear: 0.012 };
  private static readonly TIP =
    WireStationPiece.CABLE.exit - WireStationPiece.CABLE.length - WireStationPiece.CABLE.gap;
  private static readonly REEL = { x: 1.1, lift: 0.058 };
  private static readonly BLOCK = { x: 0.76 };
  private static readonly IRON = { x: 0.8, lift: 0.034, z: -0.2, reach: 0.6 };
  private static readonly PANEL = { x: 0.95, y: 1.27, z: -0.27, wall: 1.24 };
  private static readonly SLUG = { back: 0.025, out: 0.06 };
  private static readonly INSULATION = { color: 0xc81e24, roughness: 0.42 };
  private static readonly ART = { windings: 64, label: 128, panel: { width: 300, height: 130 } };
  private static readonly LAMPS = {
    done: { color: 0x39ff6a, glow: 3 },
    current: { color: 0xffb020, glow: 1.2, pulse: 3, rate: 5 },
    error: { color: 0xff3030, glow: 4, rate: 9 },
    off: { color: 0x39ff6a, glow: 0.04 },
  };
  private static readonly FAN_RATE = 5;
  private static readonly BARE = new Set([WireStep.Stripped, WireStep.Ruined]);
  private static readonly TINNED = new Set([WireStep.Tinned, WireStep.Connecting, WireStep.Connected]);

  private readonly layout: WorkshopLayout;
  private readonly insulation = new MeshStandardMaterial({
    ...WireStationPiece.INSULATION,
    envMapIntensity: 0.4,
  });
  private readonly table = new WireTable();
  private readonly reel: WireReel;
  private readonly lead = new WireLead(this.insulation);
  private readonly stripper = new CableStripper();
  private readonly iron: SolderingIron;
  private readonly smoke: SolderSmoke;
  private readonly block = new TerminalBlock(WireLead.RADIUS);
  private readonly panel: StepPanel;
  private readonly tip = new Vector3();
  private readonly bite = new Vector3();
  private readonly drop = new Vector3();
  private level = 0;
  private fan = 0;

  /**
   * Crea la estación.
   *
   * @param context Materiales, texturas, ubicación, audio y azar del taller.
   * @param source Estación (estado y reloj de sus animaciones).
   */
  public constructor(
    context: WorkshopContext,
    private readonly source: WireStationSource,
  ) {
    super();
    this.layout = context.layout;
    this.reel = this.createReel(context.textures);
    this.panel = this.createPanel(context.textures);
    const { touch, release } = WireStationService.TIN;
    const work = WireStationPiece.ironWork();
    this.iron = new SolderingIron(
      { rest: WireStationPiece.ironRest(), work },
      { start: touch, end: release },
    );
    this.smoke = new SolderSmoke(work, this.own(context.textures.softDot()));
  }

  /**
   * Controles que reciben el puntero.
   *
   * @returns Controles.
   */
  public controls(): WorkshopControl[] {
    return [
      { id: WireStationService.REEL, hitArea: this.reel.hitArea },
      { id: WireStationService.STRIPPER, hitArea: this.stripper.hitArea },
      { id: WireStationService.TIP, hitArea: this.lead.hitArea },
      { id: WireStationService.IRON, hitArea: this.iron.hitArea },
      { id: WireStationService.TERMINAL, hitArea: this.block.hitArea },
      { id: WireStationService.RESET, hitArea: this.panel.hitArea },
    ];
  }

  /**
   * Resalta el control señalado.
   *
   * @param id Control o `null`.
   */
  public highlight(id: string | null): void {
    this.reel.highlight(id === WireStationService.REEL);
    this.stripper.highlight(id === WireStationService.STRIPPER);
    this.lead.highlight(id === WireStationService.TIP);
    this.iron.highlight(id === WireStationService.IRON);
    this.block.highlight(id === WireStationService.TERMINAL);
    this.panel.highlight(id === WireStationService.RESET);
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.level = level;
    this.iron.setPower(level);
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.source.update(delta, elapsed);
    const state = this.source.state;
    this.reel.update(delta, state.step === WireStep.Pulling);
    this.moveLead(state);
    this.lead.setPickable(WireStationPiece.BARE.has(state.step));
    this.shapeLead(state, delta);
    this.stripper.update(delta, this.biteOf(state));
    this.iron.follow(state.step === WireStep.Tinning ? state.timer : null);
    this.smoke.update(delta, elapsed, WireStationPiece.touching(state));
    this.block.show(WireStationPiece.screw(state), state.step === WireStep.Connected ? 1 : 0, this.level);
    this.panel.show(this.lamps(state, elapsed));
  }

  /**
   * Arma la mesa y las herramientas y coloca la estación en el taller.
   */
  protected build(): void {
    const { LINE, REEL, BLOCK, PANEL, CABLE } = WireStationPiece;
    const reelY = WireTable.TOP + REEL.lift;
    const exit = { x: CABLE.exit - REEL.x, y: LINE.y - reelY, z: 0 };
    this.add(this.reel.build(exit, WireLead.RADIUS), { x: REEL.x, y: reelY, z: LINE.z });
    this.add(this.block.build(), { x: BLOCK.x, y: WireTable.TOP, z: LINE.z - TerminalBlock.WAY });
    this.add(this.panel.build(PANEL.wall - PANEL.x), PANEL);
    this.add(this.table.build());
    this.add(this.lead.build());
    this.add(this.stripper.build());
    this.add(this.iron.build());
    this.add(this.smoke.points);
    this.update(0, 0);
    this.layout.place(this.root);
  }

  /**
   * Carrete con sus texturas pintadas (las vueltas del bobinado y la etiqueta).
   *
   * @param textures Fábrica de texturas.
   * @returns Carrete.
   */
  private createReel(textures: CanvasTextureFactory): WireReel {
    const { windings, label } = WireStationPiece.ART;
    const coil = textures.paint(
      windings,
      windings,
      (context) => {
        WireReel.paintWindings(context);
      },
      1,
    );
    const tag = textures.paint(label, label, (context) => {
      WireReel.paintLabel(context);
    });
    return new WireReel({ windings: this.own(coil), label: this.own(tag) }, this.insulation);
  }

  /**
   * Panel de pasos con su serigrafía.
   *
   * @param textures Fábrica de texturas.
   * @returns Panel.
   */
  private createPanel(textures: CanvasTextureFactory): StepPanel {
    const { width, height } = WireStationPiece.ART.panel;
    const art = textures.paint(width, height, (context) => {
      StepPanel.paint(context);
    });
    return new StepPanel(this.own(art));
  }

  /**
   * Ubica la punta del tramo y su largo: sale del carrete, se corta y entra en la bornera.
   *
   * @param state Estado de la estación.
   */
  private moveLead(state: WireStationState): void {
    const { exit, length, insert, slide } = { ...WireStationPiece.CABLE, ...WireStationService.CONNECT };
    let x = WireStationPiece.TIP;
    let size = length;
    if (state.step === WireStep.Spool) {
      x = exit;
      size = 0;
    } else if (state.step === WireStep.Pulling) {
      size = WireStationPiece.ease(state.timer) * length;
      x = exit - size;
    } else if (state.step === WireStep.Connecting || state.step === WireStep.Connected) {
      const done = state.step === WireStep.Connected ? 1 : Math.min(state.timer / slide, 1);
      x -= insert * WireStationPiece.ease(done);
    }
    this.tip.set(x, WireStationPiece.LINE.y, WireStationPiece.LINE.z);
    this.lead.extend(this.tip, size);
  }

  /**
   * Aislante de la punta (empujado o caído) y forma de los hilos.
   *
   * @param state Estado de la estación.
   * @param delta Segundos desde el frame anterior.
   */
  private shapeLead(state: WireStationState, delta: number): void {
    const { SLUG, TIP, CABLE } = WireStationPiece;
    const off = state.strip >= 1;
    this.drop.set(TIP - WireLead.STRIP - SLUG.back - this.tip.x, 0, SLUG.out);
    this.lead.slide(state.strip * (WireLead.STRIP + CABLE.clear), off ? this.drop : null);
    this.fan += ((off ? 1 : 0) - this.fan) * Math.min(delta * WireStationPiece.FAN_RATE, 1);
    this.lead.shape({
      fan: this.fan,
      twist: state.twist,
      tin: WireStationPiece.tinning(state),
      cut: state.step === WireStep.Ruined,
    });
  }

  /**
   * Dónde muerde el pelacables: en el corte del aislante, que avanza hacia la punta con el pelado.
   *
   * @param state Estado de la estación.
   * @returns Punto del cable, o `null` si el pelacables está en la mesa.
   */
  private biteOf(state: WireStationState): Vector3 | null {
    if (state.step !== WireStep.Cut || !state.gripping) {
      return null;
    }
    const offset = state.strip * (WireLead.STRIP + WireStationPiece.CABLE.clear);
    return this.bite.set(this.tip.x + WireLead.STRIP - offset, this.tip.y, this.tip.z);
  }

  /**
   * Color y brillo de los LED del panel: verdes los pasos hechos, ámbar parpadeando el actual y rojo si se
   * cortaron hilos.
   *
   * @param state Estado de la estación.
   * @param elapsed Segundos desde que inició el loop.
   * @returns Un LED por paso.
   */
  private lamps(state: WireStationState, elapsed: number): { color: number; glow: number }[] {
    const { done, current, error, off } = WireStationPiece.LAMPS;
    const ruined = state.step === WireStep.Ruined;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * (ruined ? error.rate : current.rate));
    const level = Math.max(this.level, off.glow);
    return StepPanel.STEPS.map((_, index) => {
      if (index < state.stage) {
        return { color: done.color, glow: done.glow * level };
      }
      if (index > state.stage) {
        return off;
      }
      return ruined
        ? { color: error.color, glow: error.glow * pulse * level }
        : { color: current.color, glow: (current.glow + current.pulse * pulse) * level };
    });
  }

  /**
   * Avance del plateado del cobre: sube mientras el cautín toca la punta.
   *
   * @param state Estado de la estación.
   * @returns Estañado (0…1).
   */
  private static tinning(state: WireStationState): number {
    if (WireStationPiece.TINNED.has(state.step)) {
      return 1;
    }
    if (state.step !== WireStep.Tinning) {
      return 0;
    }
    const { touch, release } = WireStationService.TIN;
    const heat = (state.timer - touch) / Math.max(release - touch, Number.EPSILON);
    return WireStationPiece.ease(Math.min(Math.max(heat, 0), 1));
  }

  /**
   * Indica si el cautín está tocando el cobre (sale humo).
   *
   * @param state Estado de la estación.
   * @returns `true` durante el contacto.
   */
  private static touching(state: WireStationState): boolean {
    const { touch, release } = WireStationService.TIN;
    return state.step === WireStep.Tinning && state.timer >= touch && state.timer <= release;
  }

  /**
   * Avance del apriete del tornillo de la bornera.
   *
   * @param state Estado de la estación.
   * @returns Apriete (0…1).
   */
  private static screw(state: WireStationState): number {
    if (state.step === WireStep.Connected) {
      return 1;
    }
    if (state.step !== WireStep.Connecting) {
      return 0;
    }
    const { slide, screw } = WireStationService.CONNECT;
    const turn = (state.timer - slide) / Math.max(screw - slide, Number.EPSILON);
    return WireStationPiece.ease(Math.min(Math.max(turn, 0), 1));
  }

  /**
   * Punta del cautín en reposo, dentro del resorte de su base.
   *
   * @returns Punto local del taller.
   */
  private static ironRest(): Vector3 {
    const { x, lift, z } = WireStationPiece.IRON;
    return new Vector3(x, WireTable.TOP + lift, z);
  }

  /**
   * Punta del cautín tocando el cobre pelado.
   *
   * @returns Punto local del taller.
   */
  private static ironWork(): Vector3 {
    const { LINE, TIP, IRON } = WireStationPiece;
    return new Vector3(TIP + WireLead.STRIP * IRON.reach, LINE.y + WireLead.RADIUS / 2, LINE.z);
  }

  /**
   * Curva suave de entrada y salida.
   *
   * @param t Avance lineal (0…1).
   * @returns Avance suavizado.
   */
  private static ease(t: number): number {
    return t * t * (3 - 2 * t);
  }
}
