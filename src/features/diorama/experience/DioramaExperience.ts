import { SeededRandom } from '@shared/core/math/SeededRandom';
import { AdaptiveResolution } from '@shared/engine/AdaptiveResolution';
import { PointerPicker } from '@shared/engine/PointerPicker';
import type { QualityProfile } from '@shared/engine/QualityProfile';
import { RenderLoop } from '@shared/engine/RenderLoop';
import { Stage } from '@shared/engine/Stage';
import { CameraRig } from '../camera/CameraRig';
import { PowerOnSequence } from '../intro/PowerOnSequence';
import type { Hotspot } from '../models/Hotspot';
import type { SignalService } from '../services/SignalService';
import { CanvasTextureFactory } from '../scene/CanvasTextureFactory';
import { DioramaScene } from '../scene/DioramaScene';
import { MaterialLibrary } from '../scene/MaterialLibrary';
import type { HotspotMarker } from '../scene/objects/HotspotMarker';

/**
 * Orquesta la experiencia 3D (patrón Facade): escenario, diorama, cámara, bucle, intro e interacción.
 * El componente DOM solo le pasa eventos y tamaños.
 */
export class DioramaExperience {
  private static readonly SEED = 20240601;

  private readonly stage: Stage;
  private readonly diorama: DioramaScene;
  private readonly rig: CameraRig;
  private readonly loop: RenderLoop;
  private readonly picker = new PointerPicker<HotspotMarker>();
  private hovered: HotspotMarker | null = null;
  private interactive = false;

  /**
   * Crea la experiencia sobre un canvas.
   *
   * @param canvas Canvas donde se dibuja.
   * @param quality Perfil de calidad.
   * @param signal Service del lazo de control.
   */
  public constructor(canvas: HTMLCanvasElement, quality: QualityProfile, signal: SignalService) {
    const random = new SeededRandom(DioramaExperience.SEED);
    this.stage = new Stage(canvas, quality);
    this.diorama = new DioramaScene(
      new MaterialLibrary(new CanvasTextureFactory(random)),
      random,
      quality,
      signal,
    );
    this.rig = new CameraRig(this.stage.camera);
    this.loop = new RenderLoop(this.stage.renderer, () => {
      this.stage.render();
    });
  }

  /**
   * Construye la escena, compila shaders y arranca el bucle.
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
    this.loop.add(this.rig, new AdaptiveResolution(this.stage), ...this.diorama.updatables);
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
    await new PowerOnSequence().play(this.rig, this.diorama.powerSteps, instant);
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
   * Detecta el marcador bajo el puntero y lo resalta.
   *
   * @returns Punto interactivo señalado o `null`.
   */
  public hover(): Hotspot | null {
    const marker = this.interactive ? this.picker.pick(this.stage.camera) : null;
    if (marker !== this.hovered) {
      this.hovered?.setHovered(false);
      marker?.setHovered(true);
      this.hovered = marker;
    }
    return marker?.hotspot ?? null;
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
   * Detiene el bucle y libera la GPU.
   */
  public dispose(): void {
    this.loop.stop();
    this.diorama.dispose();
    this.stage.dispose();
  }
}
