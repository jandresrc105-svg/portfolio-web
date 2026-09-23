import type { Scene, Vector3Like } from 'three';
import type { SeededRandom } from '@shared/core/math/SeededRandom';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import { RenderLayer } from '@shared/engine/RenderLayer';
import type { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Hotspot } from '../models/Hotspot';
import { PowerMode } from '../models/PowerMode';
import type { PowerStep } from '../models/PowerStep';
import type { Weather } from '../models/Weather';
import { BreakerPanelService } from '../services/BreakerPanelService';
import { PayPhoneService } from '../services/PayPhoneService';
import type { ScopeControlService } from '../services/ScopeControlService';
import { CanvasTextureFactory } from './CanvasTextureFactory';
import { PowerGroup } from './PowerGroup';
import { Storm } from './Storm';
import { SwitchedLine } from './SwitchedLine';
import type { MaterialLibrary } from './MaterialLibrary';
import type { DioramaSceneOptions } from './DioramaSceneOptions';
import { Chef } from './characters/Chef';
import { Juan } from './characters/Juan';
import { CircuitBoard } from './objects/CircuitBoard';
import { CitySkyline } from './objects/CitySkyline';
import { CityBokeh } from './objects/CityBokeh';
import { ContactShadows } from './objects/ContactShadows';
import { FloatingDebris } from './objects/FloatingDebris';
import { HotspotMarker } from './objects/HotspotMarker';
import { Island } from './objects/Island';
import { KitchenProps } from './objects/KitchenProps';
import { Lantern } from './objects/Lantern';
import { LightCone } from './objects/LightCone';
import { ManekiNeko } from './objects/ManekiNeko';
import { Moonlight } from './objects/Moonlight';
import { NeonSign } from './objects/NeonSign';
import { Noren } from './objects/Noren';
import { Oscilloscope } from './objects/Oscilloscope';
import { PhoneBooth } from './objects/PhoneBooth';
import { Puddles } from './objects/Puddles';
import { Rain } from './objects/Rain';
import { RainSplashes } from './objects/RainSplashes';
import { RamenBowl } from './objects/RamenBowl';
import { RoofDrips } from './objects/RoofDrips';
import { SideBlinds } from './objects/SideBlinds';
import { SkyDome } from './objects/SkyDome';
import { Stall } from './objects/Stall';
import { StallInterior } from './objects/StallInterior';
import { StreetMarkings } from './objects/StreetMarkings';
import { StringLights } from './objects/StringLights';
import { UtilityPole } from './objects/UtilityPole';
import { VendingMachine } from './objects/VendingMachine';
import { BreakerPanel } from './panel/BreakerPanel';

/**
 * Diorama completo (patrón Composite): crea cada pieza, la agrega a la escena y expone
 * qué se actualiza por frame, en qué orden se enciende y dónde están los puntos interactivos.
 */
export class DioramaScene {
  private static readonly HOTSPOTS: Hotspot[] = [
    { sectionId: 'sobre-mi', label: 'Sobre mí', anchor: { x: 0.5, y: 2.08, z: 1.9 } },
    { sectionId: 'tecnologias', label: 'Tecnologías', anchor: { x: 3.55, y: 2.25, z: 0.35 } },
    { sectionId: 'habilidades', label: 'Habilidades', anchor: { x: -1.2, y: 1.6, z: 0.8 } },
    { sectionId: 'experiencia', label: 'Experiencia', anchor: { x: -3.75, y: 2.1, z: -0.6 } },
    { sectionId: 'contacto', label: 'Contacto', anchor: { x: -3.1, y: 2.55, z: 2.2 } },
  ];
  private static readonly SHOWCASE_SECTION = 'tecnologias';
  private static readonly CONTACT_SECTION = 'contacto';
  private static readonly TIMELINE_SECTION = 'experiencia';
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
    light: 0,
  };
  private static readonly TIMELINE = {
    street: 0.9,
    interior: 2.35,
    mainSign: 2.95,
    sideSign: 3.45,
    vending: 3.75,
    phone: 3.6,
    electronics: 4.1,
    markers: 5.3,
    markerStagger: 0.12,
  };

  public readonly updatables: Updatable[] = [];
  public readonly powerSteps: PowerStep[] = [];
  public readonly markers: HotspotMarker[] = [];
  public storm: Storm | null = null;
  public mainSign: NeonSign | null = null;
  public puddles: Puddles | null = null;
  public vending: VendingMachine | null = null;
  public oscilloscope: Oscilloscope | null = null;
  public phoneBooth: PhoneBooth | null = null;
  public breakerPanel: BreakerPanel | null = null;
  public streetLine: SwitchedLine | null = null;

  private readonly objects: SceneObject[] = [];
  private readonly luminous: SceneObject[] = [];
  private readonly materials: MaterialLibrary;
  private readonly textures: CanvasTextureFactory;
  private readonly random: SeededRandom;
  private readonly quality: QualityProfile;
  private readonly instrument: ScopeControlService;
  private readonly weather: Weather;

  /**
   * Prepara el diorama.
   *
   * @param options Materiales, texturas, azar, calidad, lazo de control y clima.
   */
  public constructor(options: DioramaSceneOptions) {
    this.materials = options.materials;
    this.textures = options.textures;
    this.random = options.random;
    this.quality = options.quality;
    this.instrument = options.instrument;
    this.weather = options.weather;
  }

  /**
   * Posición del letrero principal, fuente del zumbido de neón.
   *
   * @returns Posición en la escena.
   */
  public get neonPosition(): Vector3Like {
    const { x, y, z } = DioramaScene.MAIN_SIGN;
    return { x, y, z };
  }

  /**
   * Puntos interactivos del diorama, en el orden de las secciones.
   *
   * @returns Lista de puntos interactivos.
   */
  public get hotspots(): readonly Hotspot[] {
    return DioramaScene.HOTSPOTS;
  }

  /**
   * Sección de la página que muestra la vitrina.
   *
   * @returns Id de la sección.
   */
  public get showcaseSection(): string {
    return DioramaScene.SHOWCASE_SECTION;
  }

  /**
   * Encuadre de cámara de la vitrina (el hero es el encuadre 0).
   *
   * @returns Índice del encuadre.
   */
  public get showcaseStop(): number {
    return (
      DioramaScene.HOTSPOTS.findIndex((hotspot) => hotspot.sectionId === DioramaScene.SHOWCASE_SECTION) + 1
    );
  }

  /**
   * Parada del recorrido de la sección de la trayectoria (la del tablero del poste).
   *
   * @returns Índice de la parada.
   */
  public get timelineStop(): number {
    return (
      DioramaScene.HOTSPOTS.findIndex((hotspot) => hotspot.sectionId === DioramaScene.TIMELINE_SECTION) + 1
    );
  }

  /**
   * Parada del recorrido de la sección de contacto (la del teléfono).
   *
   * @returns Índice de la parada.
   */
  public get contactStop(): number {
    return (
      DioramaScene.HOTSPOTS.findIndex((hotspot) => hotspot.sectionId === DioramaScene.CONTACT_SECTION) + 1
    );
  }

  /**
   * Construye todas las piezas dentro de la escena.
   *
   * @param scene Escena destino.
   */
  public build(scene: Scene): void {
    this.buildSky(scene);
    this.buildEnvironment();
    this.buildStall();
    this.buildCounter();
    this.buildStreet();
    this.buildMarkers();
    this.objects.forEach((object) => scene.add(object.create()));
    this.luminous.forEach((object) => {
      object.enableLayer(RenderLayer.Reflected);
    });
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
   * Luna y fondo oscuro; según el clima, también el cielo con nubes, la ciudad y la tormenta que los ilumina.
   *
   * @param scene Escena (para fondo y niebla).
   */
  private buildSky(scene: Scene): void {
    const moonlight = this.register(new Moonlight(scene, this.weather.fog));
    if (!this.weather.backdrop) {
      return;
    }
    const sky = this.animate(new SkyDome());
    const city = this.register(new CitySkyline(this.quality.buildings, this.random));
    if (this.weather.storm) {
      this.storm = new Storm(moonlight.moon, sky, city, this.random);
      this.updatables.push(this.storm);
      this.powerSteps.push({ target: this.storm, at: DioramaScene.TIMELINE.markers, mode: PowerMode.Fade });
    }
  }

  /**
   * Isla flotante con marcas viales y charcos; según el clima, lluvia con salpicaduras, rocas flotantes
   * y luces lejanas de la ciudad.
   */
  private buildEnvironment(): void {
    this.register(new Island(this.materials, this.random));
    this.register(new StreetMarkings(this.textures, this.random));
    this.register(new ContactShadows(this.textures));
    this.puddles = this.animate(new Puddles(this.quality.reflections, this.random));
    if (this.weather.rain) {
      this.animate(new RainSplashes(this.quality.splashes, this.random));
      this.animate(new Rain(this.quality.rainDrops, this.random));
    }
    if (this.weather.backdrop) {
      this.animate(new FloatingDebris(this.materials, this.random));
      this.animate(new CityBokeh(this.textures, this.random));
    }
  }

  /**
   * Puesto: estructura, interior, cortinas, goteras (si llueve), cocina, cocinero, comensal, guirnalda y faroles.
   */
  private buildStall(): void {
    this.register(new Stall(this.materials));
    this.power(
      new StallInterior(this.materials, this.textures),
      DioramaScene.TIMELINE.interior,
      PowerMode.Fade,
    );
    this.animate(new Noren(this.textures));
    if (this.weather.rain) {
      this.animate(new RoofDrips(this.random));
    }
    this.animate(new SideBlinds(this.textures));
    this.buildLife();
    DioramaScene.LANTERNS.forEach(({ anchor, glyph, phase, at }) => {
      const lantern = this.glow(
        this.animate(new Lantern(this.materials, this.textures, anchor, glyph, phase)),
      );
      this.power(lantern, at, PowerMode.Fade);
    });
  }

  /**
   * Vida dentro del puesto: cocina humeante, cocinero, comensal y guirnalda de bombillos.
   */
  private buildLife(): void {
    this.animate(new KitchenProps(this.materials, this.random));
    this.animate(new Chef());
    this.animate(new Juan());
    this.power(
      this.glow(this.animate(new StringLights(this.materials))),
      DioramaScene.TIMELINE.interior,
      PowerMode.Fade,
    );
  }

  /**
   * Letreros de neón y objetos sobre la barra: ramen, gato de la suerte, osciloscopio y placa.
   */
  private buildCounter(): void {
    this.mainSign = this.glow(this.animate(this.createMainSign()));
    this.power(this.mainSign, DioramaScene.TIMELINE.mainSign, PowerMode.Strike);
    this.power(
      this.glow(this.animate(this.createSideSign())),
      DioramaScene.TIMELINE.sideSign,
      PowerMode.Strike,
    );
    this.animate(new RamenBowl(this.textures, this.random));
    this.animate(new ManekiNeko());
    this.buildLab();
  }

  /**
   * Banco de pruebas sobre la barra: osciloscopio y placa del controlador con su motor y la sonda.
   */
  private buildLab(): void {
    const oscilloscope = this.animate(new Oscilloscope(this.materials, this.textures, this.instrument));
    this.oscilloscope = oscilloscope;
    this.power(oscilloscope, DioramaScene.TIMELINE.electronics, PowerMode.Fade);
    this.power(
      this.animate(
        new CircuitBoard(this.textures, this.instrument.loop, (target) => oscilloscope.probePort(target)),
      ),
      DioramaScene.TIMELINE.electronics,
      PowerMode.Fade,
    );
  }

  /**
   * Calle: poste con farola (detrás del MAIN del tablero), tablero de la trayectoria, máquina expendedora y
   * cabina telefónica.
   */
  private buildStreet(): void {
    const pole = this.glow(this.register(new UtilityPole(this.materials)));
    const cone = this.register(new LightCone());
    this.streetLine = new SwitchedLine(new PowerGroup(pole, cone));
    this.updatables.push(this.streetLine);
    this.powerSteps.push({
      target: this.streetLine,
      at: DioramaScene.TIMELINE.street,
      mode: PowerMode.Strike,
    });
    this.buildPanel();
    this.vending = this.glow(this.animate(new VendingMachine(this.textures)));
    this.power(this.vending, DioramaScene.TIMELINE.vending, PowerMode.Strike);
    this.phoneBooth = this.glow(
      this.animate(new PhoneBooth(this.materials, this.textures, PayPhoneService.KEYS)),
    );
    this.power(this.phoneBooth, DioramaScene.TIMELINE.phone, PowerMode.Strike);
  }

  /**
   * Tablero de la trayectoria montado en el poste, con el medidor debajo.
   */
  private buildPanel(): void {
    const ids = {
      door: BreakerPanelService.DOOR,
      main: BreakerPanelService.MAIN,
      breaker: (index: number): string => BreakerPanelService.breakerId(index),
    };
    this.breakerPanel = this.animate(new BreakerPanel(this.textures, ids));
    this.power(this.breakerPanel, DioramaScene.TIMELINE.street, PowerMode.Fade);
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
  private createMainSign(): NeonSign {
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
  private createSideSign(): NeonSign {
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
   * Marca una pieza luminosa para que aparezca en los reflejos de los charcos.
   *
   * @param object Pieza luminosa.
   * @returns La misma pieza.
   */
  private glow<T extends SceneObject>(object: T): T {
    this.luminous.push(object);
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
