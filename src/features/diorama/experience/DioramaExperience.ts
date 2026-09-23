import { gsap } from 'gsap';
import { Vector3 } from 'three';
import type { ContactChannel } from '@shared/core/events/ContactChannel';
import { SeededRandom } from '@shared/core/math/SeededRandom';
import { AdaptiveResolution } from '@shared/engine/AdaptiveResolution';
import { DetailCuller } from '@shared/engine/DetailCuller';
import { LightZones } from '@shared/engine/LightZones';
import { RenderGate } from '@shared/engine/RenderGate';
import { PointerPicker } from '@shared/engine/PointerPicker';
import { RenderLayer } from '@shared/engine/RenderLayer';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import { RenderLoop } from '@shared/engine/RenderLoop';
import { Stage } from '@shared/engine/Stage';
import { UpdateScheduler } from '@shared/engine/UpdateScheduler';
import { AudibleSwitch } from '../audio/AudibleSwitch';
import type { Soundscape } from '../audio/Soundscape';
import { CameraDirector } from '../camera/CameraDirector';
import { PowerOnSequence } from '../intro/PowerOnSequence';
import type { DeviceInteraction } from '../models/DeviceInteraction';
import type { DioramaDevices } from '../models/DioramaDevices';
import type { Hotspot } from '../models/Hotspot';
import type { ScopeControlId } from '../models/ScopeControlId';
import { PowerMode } from '../models/PowerMode';
import type { PowerStep } from '../models/PowerStep';
import type { Weather } from '../models/Weather';
import { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import { DioramaScene } from '../scene/DioramaScene';
import { MaterialLibrary } from '../scene/MaterialLibrary';
import { NeonEnvironment } from '../scene/NeonEnvironment';
import type { HotspotMarker } from '../scene/objects/HotspotMarker';
import { BenchInteraction } from './BenchInteraction';
import { WorkshopInteraction } from './WorkshopInteraction';
import { ZoneProxies } from './ZoneProxies';
import { PanelInteraction } from './PanelInteraction';
import { PhoneInteraction } from './PhoneInteraction';

/**
 * Orquesta la experiencia 3D (patrón Facade): escenario, diorama, cámara, bucle, intro, sonido e interacción
 * (marcadores, latas, osciloscopio, teléfono, tablero del poste y banco del taller).
 * El componente DOM solo le pasa eventos, tamaños y a qué parada del recorrido ir; el arrastre, la rueda y
 * los gestos táctiles sobre el canvas los maneja directamente {@link CameraDirector}.
 */
export class DioramaExperience {
  private static readonly SEED = 20240601;
  private static readonly ENVIRONMENT_INTENSITY = 0.5;
  private static readonly ZONES = { street: 'street', workshop: 'workshop' };
  private static readonly TRAVEL_SECONDS = 1.7;

  private readonly stage: Stage;
  private readonly diorama: DioramaScene;
  private readonly director: CameraDirector;
  private readonly loop: RenderLoop;
  private readonly picker = new PointerPicker<HotspotMarker>();
  private readonly controls = new PointerPicker<ScopeControlId>();
  private readonly resolution: AdaptiveResolution;
  private readonly scheduler: UpdateScheduler;
  private readonly culler: DetailCuller;
  private readonly gate = new RenderGate();
  private proxy: ZoneProxies | null = null;
  private lights: LightZones | null = null;
  private lightsCall: gsap.core.Tween | null = null;
  private lastStop = 0;
  private readonly focus = new Vector3();
  private readonly stations: { stops: readonly number[]; device: DeviceInteraction }[] = [];
  private phone: PhoneInteraction | null = null;
  private call: ((channel: ContactChannel) => void) | null = null;
  private hovered: HotspotMarker | null = null;
  private hoveredItem: number | null = null;
  private hoveredControl: ScopeControlId | null = null;
  private turning: { id: ScopeControlId | null; apply: (pixels: number) => void } | null = null;
  private holding = false;
  private interactive = false;
  private stop = 0;

  /**
   * Crea la experiencia sobre un canvas.
   *
   * @param canvas Canvas donde se dibuja.
   * @param quality Perfil de calidad.
   * @param devices Osciloscopio y teléfono que el visitante usa.
   * @param sound Paisaje sonoro.
   * @param weather Clima de la escena.
   */
  public constructor(
    canvas: HTMLCanvasElement,
    quality: QualityProfile,
    private readonly devices: DioramaDevices,
    private readonly sound: Soundscape,
    weather: Weather,
  ) {
    const { instrument } = devices;
    const random = new SeededRandom(DioramaExperience.SEED);
    this.stage = new Stage(canvas, quality);
    const textures = new CanvasTextureFactory(random, this.stage.maxAnisotropy, quality.textureScale);
    const materials = new MaterialLibrary(textures);
    const audio = sound.audio;
    this.diorama = new DioramaScene({ materials, textures, random, quality, instrument, weather, audio });
    this.director = new CameraDirector(this.stage.camera, canvas);
    this.resolution = new AdaptiveResolution(this.stage, quality, () => this.loop.resting);
    this.scheduler = new UpdateScheduler(this.stage.camera);
    this.culler = new DetailCuller(this.stage.camera, this.gate);
    this.loop = new RenderLoop(this.stage.renderer, this.stage.render.bind(this.stage));
  }

  /**
   * Puntos interactivos del diorama, en el orden de las secciones de la página.
   *
   * @returns Puntos interactivos.
   */
  public get hotspots(): readonly Hotspot[] {
    return this.diorama.hotspots;
  }

  /**
   * Sección de la página que muestra la vitrina.
   *
   * @returns Id de la sección.
   */
  public get showcaseSection(): string {
    return this.diorama.showcaseSection;
  }

  /**
   * Construye la escena, conecta el sonido, compila shaders y arranca el bucle.
   *
   * @param width Ancho del viewport.
   * @param height Alto del viewport.
   * @returns Promesa que se resuelve cuando la escena está lista para mostrarse.
   */
  public async prepare(width: number, height: number): Promise<void> {
    this.diorama.build(this.stage.scene);
    this.bakeEnvironment();
    this.diorama.markers.forEach((marker) => {
      this.picker.register(marker.hitArea, marker);
    });
    this.diorama.oscilloscope?.controls.forEach(({ id, hitArea }) => {
      this.controls.register(hitArea, id);
    });
    this.focusShowcase();
    this.connectPhone();
    this.connectPanel();
    this.connectWorkshop();
    this.connectSound();
    this.connectMirror();
    this.schedule();
    this.resize(width, height);
    await this.warmUp();
    this.loop.start();
  }

  /**
   * Reproduce la secuencia de encendido y habilita la interacción.
   *
   * @param instant Saltar la animación (movimiento reducido).
   * @returns Promesa que se resuelve al terminar la intro.
   */
  public async powerOn(instant: boolean): Promise<void> {
    const steps = this.diorama.powerSteps.map((step) => this.withSound(step));
    await new PowerOnSequence().play(this.director, steps, instant);
    this.resolution.release();
    this.interactive = true;
  }

  /**
   * Lleva la cámara a una parada del recorrido con un viaje animado.
   *
   * @param stop Índice de la parada (0 = vista general; luego una por sección, en orden).
   */
  public travelTo(stop: number): void {
    this.loop.wake();
    this.stop = stop;
    this.director.travelTo(stop);
    this.diorama.vending?.setFocused(stop === this.diorama.showcaseStop);
    this.proxy?.switchTo(stop);
    this.switchLights(stop);
    this.stations.forEach((station) => {
      station.device.setActive(station.stops.includes(stop));
    });
  }

  /**
   * Actualiza el puntero para detectar marcadores y latas (la cámara no lo sigue).
   *
   * @param x Horizontal normalizado [-1, 1].
   * @param y Vertical normalizado [-1, 1].
   */
  public setPointer(x: number, y: number): void {
    this.loop.wake();
    this.picker.setPointer(x, y);
    this.controls.setPointer(x, y);
    this.stations.forEach(({ device }) => {
      device.setPointer(x, y);
    });
  }

  /**
   * Detecta la tecla o perilla del osciloscopio bajo el puntero (o la que se está girando), la ilumina y
   * suena al entrar. Los marcadores tienen prioridad; con el equipo apagado solo responde el encendido.
   *
   * @returns Control señalado o `null`.
   */
  public hoverControl(): ScopeControlId | null {
    const id = this.turning ? this.turning.id : this.controlUnderPointer();
    if (id !== this.hoveredControl) {
      this.diorama.oscilloscope?.highlight(id);
      if (id !== null && this.turning === null) {
        this.sound.hover();
      }
      this.hoveredControl = id;
    }
    return id;
  }

  /**
   * Texto del tooltip de un control del osciloscopio.
   *
   * @param id Control.
   * @returns Texto.
   */
  public controlLabel(id: ScopeControlId): string {
    return this.devices.instrument.describe(id);
  }

  /**
   * Usa el control señalado, si hay uno: una tecla se pulsa y una perilla queda tomada para girarla. En
   * ambos casos la cámara no gira hasta soltar.
   *
   * @returns `true` si se tomó un control.
   */
  public grabControl(): boolean {
    const id = this.hoverControl();
    if (id === null) {
      return this.grabDevice();
    }
    this.holding = true;
    this.director.lockRotation(true);
    const apply = this.devices.instrument.grab(id);
    if (apply) {
      this.turning = { id, apply };
      this.sound.select();
    } else {
      this.devices.instrument.press(id);
      this.diorama.oscilloscope?.pressKey(id);
      this.sound.click();
    }
    return true;
  }

  /**
   * Gira la perilla tomada: arrastrar hacia arriba sube el valor.
   *
   * @param pixels Desplazamiento vertical desde que se tomó (positivo = hacia arriba).
   */
  public turnControl(pixels: number): void {
    this.loop.wake();
    this.turning?.apply(pixels);
  }

  /**
   * Suelta el control y devuelve el giro a la cámara.
   */
  public releaseControl(): void {
    if (!this.holding) {
      return;
    }
    this.holding = false;
    this.turning = null;
    this.director.lockRotation(false);
    this.hoverControl();
  }

  /**
   * Muestra un elemento de la vitrina: resalta su lata. La cámara usa el mismo encuadre para todos.
   *
   * @param item Índice del elemento (desde 0).
   */
  public showItem(item: number): void {
    this.loop.wake();
    this.diorama.vending?.select(item);
  }

  /**
   * Indica los elementos de la vitrina: solo sus latas responden al puntero y cada una lleva el sabor
   * (tecnología) de su elemento.
   *
   * @param flavors Sabor de la lata de cada elemento, en orden.
   */
  public setItems(flavors: readonly string[]): void {
    this.diorama.vending?.setItems(flavors);
  }

  /**
   * Nombre de la tecnología de una lata de la vitrina, para el tooltip.
   *
   * @param item Índice del elemento.
   * @returns Nombre impreso en la lata.
   */
  public itemName(item: number): string {
    return this.diorama.vending?.nameOf(item) ?? '';
  }

  /**
   * Detecta la lata de la vitrina bajo el puntero, la adelanta un poco y suena al entrar en una nueva.
   * Si hay un marcador señalado (ver {@link DioramaExperience.hover}), este tiene prioridad.
   *
   * @returns Índice del elemento señalado o `null`.
   */
  public hoverItem(): number | null {
    const item = this.itemUnderPointer();
    if (item !== this.hoveredItem) {
      this.diorama.vending?.hover(item);
      if (item !== null) {
        this.sound.hover();
      }
      this.hoveredItem = item;
    }
    return item;
  }

  /**
   * Detecta el marcador bajo el puntero (salvo el de la sección abierta, que taparía lo que se enfoca), lo
   * resalta y suena al entrar en uno nuevo.
   *
   * @returns Punto interactivo señalado o `null`.
   */
  public hover(): Hotspot | null {
    const marker = this.markerUnderPointer();
    if (marker !== this.hovered) {
      this.hovered?.setHovered(false);
      marker?.setHovered(true);
      if (marker) {
        this.sound.hover();
      }
      this.hovered = marker;
    }
    return marker?.hotspot ?? null;
  }

  /**
   * Confirma la selección del marcador señalado con su sonido.
   */
  public select(): void {
    this.loop.wake();
    this.sound.select();
  }

  /**
   * Detecta el control del equipo de la sección abierta (teléfono o tablero) bajo el puntero, si no hay un
   * marcador delante, y lo resalta.
   *
   * @returns Texto del tooltip del control señalado o `null`.
   */
  public hoverDevice(): string | null {
    const enabled = this.interactive && this.hovered === null;
    return this.station()?.hover(this.stage.camera, enabled) ?? null;
  }

  /**
   * Usa el control señalado del equipo de la sección abierta (descolgar, marcar, abrir el tablero, subir un
   * breaker…).
   *
   * @returns `true` si se usó un control.
   */
  public pressDevice(): boolean {
    this.loop.wake();
    return this.hoverDevice() !== null && (this.station()?.press() ?? false);
  }

  /**
   * Marca una tecla del teléfono desde el teclado físico, si la sección de contacto está abierta.
   *
   * @param key Tecla (`0`…`9`, `*`, `#`).
   * @returns `true` si se marcó.
   */
  public dialPhone(key: string): boolean {
    this.loop.wake();
    if (!this.interactive || this.stop !== this.diorama.contactStop) {
      return false;
    }
    this.phone?.dial(key);
    return true;
  }

  /**
   * Fija los canales del marcado rápido del teléfono.
   *
   * @param channels Canales en orden (la tecla `1` llama al primero).
   */
  public setContacts(channels: readonly ContactChannel[]): void {
    this.devices.phone.setChannels(channels);
  }

  /**
   * Define qué hacer cuando una llamada del teléfono conecta.
   *
   * @param listener Función que recibe el canal a abrir.
   */
  public onCall(listener: (channel: ContactChannel) => void): void {
    this.call = listener;
  }

  /**
   * Ajusta el render al nuevo tamaño.
   *
   * @param width Ancho del viewport.
   * @param height Alto del viewport.
   */
  public resize(width: number, height: number): void {
    this.stage.resize(width, height);
    this.director.resize();
    this.culler.setViewport(this.stage.renderer.domElement.height);
  }

  /**
   * Detiene el bucle y libera la GPU y el audio.
   */
  public dispose(): void {
    this.loop.stop();
    this.stations.forEach(({ device }) => {
      device.dispose();
    });
    this.director.dispose();
    this.sound.dispose();
    this.diorama.dispose();
    this.stage.dispose();
  }

  /**
   * Compila shaders y sube texturas antes de mostrar la escena, incluidas las variantes de las zonas de luz.
   *
   * @returns Promesa que se resuelve al terminar.
   */
  private async warmUp(): Promise<void> {
    await this.stage.warmUp();
    const lights = new LightZones(this.stage.renderer, this.stage.scene, this.stage.camera);
    const { street, workshop } = DioramaExperience.ZONES;
    lights.assign(street, this.diorama.streetRoots);
    lights.assign(workshop, this.diorama.workshopRoots);
    await lights.precompile([[street], [workshop]]);
    this.lights = lights;
  }

  /**
   * Enciende las zonas de luz de la parada destino. Durante el viaje quedan las de las dos paradas, para que la
   * luz no cambie a la vista; al llegar, solo las del destino.
   *
   * @param stop Parada destino.
   */
  private switchLights(stop: number): void {
    const target = this.zonesFor(stop);
    this.lightsCall?.kill();
    this.lights?.show([...new Set([...this.zonesFor(this.lastStop), ...target])]);
    this.lastStop = stop;
    this.lightsCall = gsap.delayedCall(DioramaExperience.TRAVEL_SECONDS, () => {
      this.lights?.show(target);
    });
  }

  /**
   * Zonas de luz que se ven desde una parada: todas en la vista general, el taller en sus paradas y la calle en
   * las demás.
   *
   * @param stop Parada.
   * @returns Zonas visibles.
   */
  private zonesFor(stop: number): string[] {
    const { street, workshop } = DioramaExperience.ZONES;
    if (stop === 0) {
      return [street, workshop];
    }
    return this.diorama.workshopStops.includes(stop) ? [workshop] : [street];
  }

  /**
   * El espejo de los charcos refleja solo la capa luminosa y se dibuja antes del render principal.
   */
  private connectMirror(): void {
    const puddles = this.diorama.puddles;
    const { renderer, scene, camera } = this.stage;
    puddles?.reflectOnly(camera, RenderLayer.Reflected);
    this.stage.setBeforeRender(() => {
      puddles?.reflect(renderer, scene, camera);
    });
  }

  /**
   * Actualización a pedido: las piezas animadas solo trabajan cuando la cámara las ve (y a ritmo completo solo
   * de cerca), los detalles diminutos salen del render desde lejos y el bucle entra en reposo cuando la cámara
   * se queda quieta y nadie interactúa.
   */
  private schedule(): void {
    this.diorama.pieces.forEach((piece) => {
      this.scheduler.track(piece, piece.root);
    });
    this.diorama.roots.forEach((root) => {
      this.culler.track(root);
    });
    this.loop.add(this.director, this.resolution, this.sound, this.devices.phone, ...this.diorama.updatables);
    this.proxy = this.createProxies();
    this.loop.add(this.scheduler, this.culler, this.proxy);
    this.director.onMotion(() => {
      this.loop.wake();
    });
  }

  /**
   * Versiones unidas del taller y de la calle, ya en el estado de la parada actual.
   *
   * @returns Versiones unidas por zona.
   */
  private createProxies(): ZoneProxies {
    const roots = { workshop: this.diorama.workshopRoots, street: this.diorama.streetProxyRoots };
    const { scene } = this.stage;
    const proxies = new ZoneProxies(scene, roots, this.gate, this.scheduler, this.diorama.workshopStops);
    proxies.switchTo(this.stop);
    return proxies;
  }

  /**
   * Hace que la parada de la vitrina encuadre la máquina expendedora completa.
   */
  private focusShowcase(): void {
    const vending = this.diorama.vending;
    if (vending) {
      this.director.setFocus(vending.focusPoint(this.focus), this.diorama.showcaseStop);
    }
  }

  /**
   * Toma para arrastrar el control señalado del equipo de la sección abierta (una perilla del taller), si hay
   * uno. La cámara no gira hasta soltar.
   *
   * @returns `true` si se tomó un control.
   */
  private grabDevice(): boolean {
    const apply = this.hoverDevice() === null ? null : (this.station()?.grab?.() ?? null);
    if (!apply) {
      return false;
    }
    this.holding = true;
    this.director.lockRotation(true);
    this.turning = { id: null, apply };
    return true;
  }

  /**
   * Conecta el teléfono de la cabina con el puntero, el sonido y la apertura de canales.
   */
  private connectPhone(): void {
    const booth = this.diorama.phoneBooth;
    if (!booth) {
      return;
    }
    this.phone = new PhoneInteraction(this.devices.phone, booth, this.sound);
    this.phone.onCall((channel) => {
      this.call?.(channel);
    });
    this.stations.push({ stops: [this.diorama.contactStop], device: this.phone });
  }

  /**
   * Conecta el tablero del poste con el puntero, el sonido y la red de la calle que controla su MAIN.
   */
  private connectPanel(): void {
    const { breakerPanel, grid } = this.diorama;
    if (breakerPanel) {
      const panel = new PanelInteraction(this.devices.panel, breakerPanel, grid, this.sound);
      this.stations.push({ stops: [this.diorama.timelineStop], device: panel });
    }
  }

  /**
   * Conecta el taller con el puntero y el sonido: los equipos del catálogo y el banco de los proyectos
   * responden en todas las secciones que se ven desde el taller.
   */
  private connectWorkshop(): void {
    const { workbench, workshopDevices, workshopStops } = this.diorama;
    const others = workbench ? [new BenchInteraction(this.devices.bench, workbench, this.sound)] : [];
    const workshop = new WorkshopInteraction(workshopDevices, others, this.sound);
    this.stations.push({ stops: workshopStops, device: workshop });
  }

  /**
   * Equipo de la sección abierta, si tiene uno.
   *
   * @returns Equipo o `undefined`.
   */
  private station(): DeviceInteraction | undefined {
    return this.stations.find((entry) => entry.stops.includes(this.stop))?.device;
  }

  /**
   * Hornea los reflejos de neón del entorno y libera la escena de referencia.
   */
  private bakeEnvironment(): void {
    const environment = new NeonEnvironment();
    this.stage.bakeEnvironment(environment.create(), DioramaExperience.ENVIRONMENT_INTENSITY);
    environment.dispose();
  }

  /**
   * Conecta la escena con el paisaje sonoro: zumbido del neón y truenos de la tormenta.
   */
  private connectSound(): void {
    this.diorama.mainSign?.mirror(this.sound.neon);
    this.sound.follow(this.stage.camera, this.diorama.neonPosition);
    this.diorama.storm?.onStrike((strength, delay) => {
      this.sound.thunder(strength, delay);
    });
  }

  /**
   * Agrega el chasquido de relé a los elementos que arrancan como tubo (patrón Decorator).
   *
   * @param step Paso de encendido original.
   * @returns Paso con sonido si corresponde.
   */
  private withSound(step: PowerStep): PowerStep {
    if (step.mode !== PowerMode.Strike) {
      return step;
    }
    const target = new AudibleSwitch(step.target, () => {
      this.sound.click();
    });
    return { ...step, target };
  }

  /**
   * Marcador bajo el puntero, sin contar el de la sección abierta.
   *
   * @returns Marcador o `null`.
   */
  private markerUnderPointer(): HotspotMarker | null {
    const current = this.diorama.markers[this.stop - 1] ?? null;
    return this.interactive ? this.picker.pick(this.stage.camera, current) : null;
  }

  /**
   * Control del osciloscopio bajo el puntero, si la escena ya es interactiva, no hay un marcador delante
   * y el control responde (con el equipo apagado, solo el encendido).
   *
   * @returns Control o `null`.
   */
  private controlUnderPointer(): ScopeControlId | null {
    const id = this.interactive && this.hovered === null ? this.controls.pick(this.stage.camera) : null;
    return id !== null && this.devices.instrument.available(id) ? id : null;
  }

  /**
   * Elemento cuya lata está bajo el puntero, si la escena ya es interactiva y no hay un marcador delante.
   *
   * @returns Índice del elemento o `null`.
   */
  private itemUnderPointer(): number | null {
    const vending = this.diorama.vending;
    const cans = vending?.pickable;
    if (!this.interactive || this.hovered !== null || !vending || !cans) {
      return null;
    }
    const hit = this.picker.cast(this.stage.camera, cans);
    return hit?.instanceId === undefined ? null : vending.itemAt(hit.instanceId);
  }
}
