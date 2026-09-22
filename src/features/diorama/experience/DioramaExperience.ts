import { SeededRandom } from '@shared/core/math/SeededRandom';
import { AdaptiveResolution } from '@shared/engine/AdaptiveResolution';
import { PointerPicker } from '@shared/engine/PointerPicker';
import { RenderLayer } from '@shared/engine/RenderLayer';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import { RenderLoop } from '@shared/engine/RenderLoop';
import { Stage } from '@shared/engine/Stage';
import { AudibleSwitch } from '../audio/AudibleSwitch';
import type { Soundscape } from '../audio/Soundscape';
import { CameraRig } from '../camera/CameraRig';
import { PowerOnSequence } from '../intro/PowerOnSequence';
import type { Hotspot } from '../models/Hotspot';
import { PowerMode } from '../models/PowerMode';
import type { PowerStep } from '../models/PowerStep';
import type { SignalService } from '../services/SignalService';
import { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import { DioramaScene } from '../scene/DioramaScene';
import { MaterialLibrary } from '../scene/MaterialLibrary';
import type { HotspotMarker } from '../scene/objects/HotspotMarker';

/**
 * Orquesta la experiencia 3D (patrón Facade): escenario, diorama, cámara, bucle, intro, sonido e interacción.
 * El componente DOM solo le pasa eventos y tamaños.
 */
export class DioramaExperience {
  private static readonly SEED = 20240601;

  private readonly stage: Stage;
  private readonly diorama: DioramaScene;
  private readonly rig: CameraRig;
  private readonly loop: RenderLoop;
  private readonly picker = new PointerPicker<HotspotMarker>();
  private readonly resolution: AdaptiveResolution;
  private hovered: HotspotMarker | null = null;
  private interactive = false;

  /**
   * Crea la experiencia sobre un canvas.
   *
   * @param canvas Canvas donde se dibuja.
   * @param quality Perfil de calidad.
   * @param signal Service del lazo de control.
   * @param sound Paisaje sonoro.
   */
  public constructor(
    canvas: HTMLCanvasElement,
    quality: QualityProfile,
    signal: SignalService,
    private readonly sound: Soundscape,
  ) {
    const random = new SeededRandom(DioramaExperience.SEED);
    this.stage = new Stage(canvas, quality);
    const textures = new CanvasTextureFactory(random, this.stage.maxAnisotropy, quality.textureScale);
    this.diorama = new DioramaScene(new MaterialLibrary(textures), textures, random, quality, signal);
    this.rig = new CameraRig(this.stage.camera);
    this.resolution = new AdaptiveResolution(this.stage, quality.maxResolutionScale);
    this.loop = new RenderLoop(this.stage.renderer, () => {
      this.stage.render();
    });
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
    this.diorama.markers.forEach((marker) => {
      this.picker.register(marker.hitArea, marker);
    });
    this.connectSound();
    this.diorama.puddles?.reflectOnly(this.stage.camera, RenderLayer.Reflected);
    this.loop.add(this.rig, this.resolution, this.sound, ...this.diorama.updatables);
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
    await new PowerOnSequence().play(this.rig, steps, instant);
    this.resolution.release();
    this.interactive = true;
  }

  /**
   * Avanza el recorrido de cámara según el scroll.
   *
   * @param progress Progreso [0, 1].
   */
  public setScroll(progress: number): void {
    this.rig.setProgress(progress);
  }

  /**
   * Actualiza el puntero para el paralaje y la detección de marcadores.
   *
   * @param x Horizontal normalizado [-1, 1].
   * @param y Vertical normalizado [-1, 1].
   */
  public setPointer(x: number, y: number): void {
    this.rig.setPointer(x, y);
    this.picker.setPointer(x, y);
  }

  /**
   * Detecta el marcador bajo el puntero, lo resalta y suena al entrar en uno nuevo.
   *
   * @returns Punto interactivo señalado o `null`.
   */
  public hover(): Hotspot | null {
    const marker = this.interactive ? this.picker.pick(this.stage.camera) : null;
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
  }

  /**
   * Detiene el bucle y libera la GPU y el audio.
   */
  public dispose(): void {
    this.loop.stop();
    this.sound.dispose();
    this.diorama.dispose();
    this.stage.dispose();
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
}
