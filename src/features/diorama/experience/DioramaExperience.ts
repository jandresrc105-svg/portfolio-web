import { Vector3 } from 'three';
import { SeededRandom } from '@shared/core/math/SeededRandom';
import { AdaptiveResolution } from '@shared/engine/AdaptiveResolution';
import { PointerPicker } from '@shared/engine/PointerPicker';
import { RenderLayer } from '@shared/engine/RenderLayer';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import { RenderLoop } from '@shared/engine/RenderLoop';
import { Stage } from '@shared/engine/Stage';
import { AudibleSwitch } from '../audio/AudibleSwitch';
import type { Soundscape } from '../audio/Soundscape';
import { CameraDirector } from '../camera/CameraDirector';
import { PowerOnSequence } from '../intro/PowerOnSequence';
import type { Hotspot } from '../models/Hotspot';
import type { ScopeControlId } from '../models/ScopeControlId';
import { PowerMode } from '../models/PowerMode';
import type { PowerStep } from '../models/PowerStep';
import type { Weather } from '../models/Weather';
import type { ScopeControlService } from '../services/ScopeControlService';
import { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import { DioramaScene } from '../scene/DioramaScene';
import { MaterialLibrary } from '../scene/MaterialLibrary';
import { NeonEnvironment } from '../scene/NeonEnvironment';
import type { HotspotMarker } from '../scene/objects/HotspotMarker';

/**
 * Orquesta la experiencia 3D (patrón Facade): escenario, diorama, cámara, bucle, intro, sonido e interacción.
 * El componente DOM solo le pasa eventos, tamaños y a qué parada del recorrido ir; el arrastre, la rueda y
 * los gestos táctiles sobre el canvas los maneja directamente {@link CameraDirector}.
 */
export class DioramaExperience {
  private static readonly SEED = 20240601;
  private static readonly ENVIRONMENT_INTENSITY = 0.5;

  private readonly stage: Stage;
  private readonly diorama: DioramaScene;
  private readonly director: CameraDirector;
  private readonly loop: RenderLoop;
  private readonly picker = new PointerPicker<HotspotMarker>();
  private readonly controls = new PointerPicker<ScopeControlId>();
  private readonly resolution: AdaptiveResolution;
  private readonly focus = new Vector3();
  private hovered: HotspotMarker | null = null;
  private hoveredItem: number | null = null;
  private hoveredControl: ScopeControlId | null = null;
  private turning: { id: ScopeControlId; apply: (pixels: number) => void } | null = null;
  private holding = false;
  private interactive = false;
  private stop = 0;

  /**
   * Crea la experiencia sobre un canvas.
   *
   * @param canvas Canvas donde se dibuja.
   * @param quality Perfil de calidad.
   * @param instrument Tablero del osciloscopio (lazo PID y estado del equipo).
   * @param sound Paisaje sonoro.
   * @param weather Clima de la escena.
   */
  public constructor(
    canvas: HTMLCanvasElement,
    quality: QualityProfile,
    private readonly instrument: ScopeControlService,
    private readonly sound: Soundscape,
    weather: Weather,
  ) {
    const random = new SeededRandom(DioramaExperience.SEED);
    this.stage = new Stage(canvas, quality);
    const textures = new CanvasTextureFactory(random, this.stage.maxAnisotropy, quality.textureScale);
    const materials = new MaterialLibrary(textures);
    this.diorama = new DioramaScene({ materials, textures, random, quality, instrument, weather });
    this.director = new CameraDirector(this.stage.camera, canvas);
    this.resolution = new AdaptiveResolution(this.stage, quality);
    this.loop = new RenderLoop(this.stage.renderer, () => {
      this.stage.render();
    });
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
    this.connectSound();
    this.diorama.puddles?.reflectOnly(this.stage.camera, RenderLayer.Reflected);
    this.loop.add(this.director, this.resolution, this.sound, ...this.diorama.updatables);
    this.resize(width, height);
    await this.stage.warmUp();
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
    this.stop = stop;
    this.director.travelTo(stop);
  }

  /**
   * Actualiza el puntero para detectar marcadores y latas (la cámara no lo sigue).
   *
   * @param x Horizontal normalizado [-1, 1].
   * @param y Vertical normalizado [-1, 1].
   */
  public setPointer(x: number, y: number): void {
    this.picker.setPointer(x, y);
    this.controls.setPointer(x, y);
  }

  /**
   * Detecta la tecla o perilla del osciloscopio bajo el puntero (o la que se está girando), la ilumina y
   * suena al entrar. Los marcadores tienen prioridad; con el equipo apagado solo responde el encendido.
   *
   * @returns Control señalado o `null`.
   */
  public hoverControl(): ScopeControlId | null {
    const id = this.turning?.id ?? this.controlUnderPointer();
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
    return this.instrument.describe(id);
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
      return false;
    }
    this.holding = true;
    this.director.lockRotation(true);
    const apply = this.instrument.grab(id);
    if (apply) {
      this.turning = { id, apply };
      this.sound.select();
    } else {
      this.instrument.press(id);
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
    this.sound.select();
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
  }

  /**
   * Detiene el bucle y libera la GPU y el audio.
   */
  public dispose(): void {
    this.loop.stop();
    this.director.dispose();
    this.sound.dispose();
    this.diorama.dispose();
    this.stage.dispose();
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
    return id !== null && this.instrument.available(id) ? id : null;
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
