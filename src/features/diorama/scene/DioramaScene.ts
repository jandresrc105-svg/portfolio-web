import type { Scene } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import type { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Hotspot } from '../models/Hotspot';
import { PowerMode } from '../models/PowerMode';
import type { PowerStep } from '../models/PowerStep';
import type { SignalService } from '../services/SignalService';
import { CanvasTextureFactory } from './CanvasTextureFactory';
import type { MaterialLibrary } from './MaterialLibrary';
import { CircuitBoard } from './objects/CircuitBoard';
import { CityBokeh } from './objects/CityBokeh';
import { FloatingDebris } from './objects/FloatingDebris';
import { HotspotMarker } from './objects/HotspotMarker';
import { Island } from './objects/Island';
import { Lantern } from './objects/Lantern';
import { Moonlight } from './objects/Moonlight';
import { NeonSign } from './objects/NeonSign';
import { Noren } from './objects/Noren';
import { Oscilloscope } from './objects/Oscilloscope';
import { Postbox } from './objects/Postbox';
import { Puddles } from './objects/Puddles';
import { Rain } from './objects/Rain';
import { RamenBowl } from './objects/RamenBowl';
import { Stall } from './objects/Stall';
import { StallInterior } from './objects/StallInterior';
import { UtilityPole } from './objects/UtilityPole';
import { VendingMachine } from './objects/VendingMachine';

/**
 * Diorama completo (patrón Composite): crea cada pieza, la agrega a la escena y expone
 * qué se actualiza por frame, en qué orden se enciende y dónde están los puntos interactivos.
 */
export class DioramaScene {
  private static readonly HOTSPOTS: Hotspot[] = [
    { sectionId: 'sobre-mi', label: 'Sobre mí', anchor: { x: -0.55, y: 2.05, z: 1.95 } },
    { sectionId: 'proyectos', label: 'Proyectos', anchor: { x: 3.55, y: 2.25, z: 0.35 } },
    { sectionId: 'habilidades', label: 'Habilidades', anchor: { x: -1.2, y: 1.72, z: 0.8 } },
    { sectionId: 'experiencia', label: 'Experiencia', anchor: { x: -3.75, y: 2.1, z: -0.6 } },
    { sectionId: 'contacto', label: 'Contacto', anchor: { x: -2.95, y: 1.6, z: 2.1 } },
  ];
  private static readonly LANTERNS = [
    { anchor: { x: -2.35, y: 2.55, z: 1.62 }, glyph: '麺', phase: 0, at: 1.6 },
    { anchor: { x: 2.35, y: 2.55, z: 1.62 }, glyph: '灯', phase: 1.7, at: 1.95 },
  ];
  private static readonly MAIN_SIGN = {
    width: 3.1,
    height: 0.8,
    x: 0,
    y: 3.3,
    z: 1.25,
    size: 150,
    light: 10,
  };
  private static readonly SIDE_SIGN = {
    width: 1.05,
    height: 0.62,
    x: 2.72,
    y: 2.15,
    z: 1.05,
    rotation: -0.55,
    light: 3.5,
  };
  private static readonly TIMELINE = {
    street: 0.9,
    interior: 2.35,
    mainSign: 2.95,
    sideSign: 3.45,
    vending: 3.75,
    electronics: 4.1,
    markers: 5.3,
    markerStagger: 0.12,
  };

  public readonly updatables: Updatable[] = [];
  public readonly powerSteps: PowerStep[] = [];
  public readonly markers: HotspotMarker[] = [];

  private readonly objects: SceneObject[] = [];
  private readonly textures: CanvasTextureFactory;

  /**
   * Prepara el diorama.
   *
   * @param materials Materiales compartidos.
   * @param random Generador determinista.
   * @param quality Perfil de calidad.
   * @param signal Service del lazo de control para el osciloscopio.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly random: SeededRandom,
    private readonly quality: QualityProfile,
    private readonly signal: SignalService,
  ) {
    this.textures = new CanvasTextureFactory(random);
  }

  /**
   * Construye todas las piezas dentro de la escena.
   *
   * @param scene Escena destino.
   */
  public build(scene: Scene): void {
    this.buildEnvironment(scene);
    this.buildStall();
    this.buildCounter();
    this.buildStreet();
    this.buildMarkers();
    this.objects.forEach((object) => scene.add(object.create()));
  }

  /**
   * Libera todos los recursos de GPU.
   */
  public dispose(): void {
    this.objects.forEach((object) => {
      object.dispose();
    });
    this.materials.dispose();
  }

  /**
   * Cielo, isla flotante, escombros, lluvia y ciudad lejana.
   *
   * @param scene Escena (para fondo y niebla).
   */
  private buildEnvironment(scene: Scene): void {
    this.register(new Moonlight(scene));
    this.register(new Island(this.materials, this.random));
    this.register(new Puddles(this.quality.reflections, this.random));
    this.animate(new FloatingDebris(this.materials, this.random));
    this.animate(new Rain(this.quality.rainDrops, this.random));
    this.animate(new CityBokeh(this.textures, this.random));
  }

  /**
   * Puesto: estructura, interior, cortinas y faroles.
   */
  private buildStall(): void {
    this.register(new Stall(this.materials));
    this.power(
      new StallInterior(this.materials, this.textures),
      DioramaScene.TIMELINE.interior,
      PowerMode.Fade,
    );
    this.animate(new Noren(this.textures));
    DioramaScene.LANTERNS.forEach(({ anchor, glyph, phase, at }) => {
      const lantern = this.animate(new Lantern(this.materials, this.textures, anchor, glyph, phase));
      this.power(lantern, at, PowerMode.Fade);
    });
  }

  /**
   * Letreros de neón y objetos sobre la barra: ramen, osciloscopio y placa.
   */
  private buildCounter(): void {
    this.power(this.animate(this.mainSign()), DioramaScene.TIMELINE.mainSign, PowerMode.Strike);
    this.power(this.animate(this.sideSign()), DioramaScene.TIMELINE.sideSign, PowerMode.Strike);
    this.animate(new RamenBowl(this.materials, this.textures, this.random));
    const oscilloscope = this.animate(new Oscilloscope(this.materials, this.textures, this.signal));
    this.power(oscilloscope, DioramaScene.TIMELINE.electronics, PowerMode.Fade);
    this.power(
      this.animate(new CircuitBoard(this.materials)),
      DioramaScene.TIMELINE.electronics,
      PowerMode.Fade,
    );
  }

  /**
   * Calle: poste con farola, máquina expendedora y buzón.
   */
  private buildStreet(): void {
    this.power(this.animate(new UtilityPole(this.materials)), DioramaScene.TIMELINE.street, PowerMode.Strike);
    this.power(new VendingMachine(this.textures), DioramaScene.TIMELINE.vending, PowerMode.Strike);
    this.register(new Postbox(this.materials));
  }

  /**
   * Marcadores de los puntos interactivos.
   */
  private buildMarkers(): void {
    DioramaScene.HOTSPOTS.forEach((hotspot, index) => {
      const marker = this.animate(new HotspotMarker(hotspot));
      this.markers.push(marker);
      const { markers, markerStagger } = DioramaScene.TIMELINE;
      this.power(marker, markers + index * markerStagger, PowerMode.Fade);
    });
  }

  /**
   * Letrero principal de neón sobre el techo.
   *
   * @returns Letrero.
   */
  private mainSign(): NeonSign {
    const { width, height, x, y, z, size, light } = DioramaScene.MAIN_SIGN;
    return new NeonSign(this.textures, {
      lines: [{ text: 'ラーメン', size, font: CanvasTextureFactory.JAPANESE_FONT }],
      color: '#ff2d78',
      lightColor: 0xff2d78,
      size: { width, height },
      position: { x, y, z },
      rotationY: 0,
      lightIntensity: light,
    });
  }

  /**
   * Letrero lateral en inglés, en cian para contrastar con el magenta.
   *
   * @returns Letrero.
   */
  private sideSign(): NeonSign {
    const { width, height, x, y, z, rotation, light } = DioramaScene.SIDE_SIGN;
    return new NeonSign(this.textures, {
      lines: [
        { text: 'RAMEN', size: 78, font: CanvasTextureFactory.MONO_FONT },
        { text: '& CIRCUITS', size: 44, font: CanvasTextureFactory.MONO_FONT },
      ],
      color: '#3fd8ff',
      lightColor: 0x3fd8ff,
      size: { width, height },
      position: { x, y, z },
      rotationY: rotation,
      lightIntensity: light,
    });
  }

  /**
   * Registra una pieza estática.
   *
   * @param object Pieza.
   * @returns La misma pieza.
   */
  private register<T extends SceneObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  /**
   * Registra una pieza animada.
   *
   * @param object Pieza que se actualiza por frame.
   * @returns La misma pieza.
   */
  private animate<T extends SceneObject & Updatable>(object: T): T {
    this.updatables.push(object);
    return this.register(object);
  }

  /**
   * Registra una pieza en la secuencia de encendido (y en la escena si aún no lo está).
   *
   * @param object Pieza encendible.
   * @param at Segundo de la intro.
   * @param mode Forma de encendido.
   */
  private power(
    object: SceneObject & { setPower: (level: number) => void },
    at: number,
    mode: PowerMode,
  ): void {
    if (!this.objects.includes(object)) {
      this.register(object);
    }
    this.powerSteps.push({ target: object, at, mode });
  }
}
