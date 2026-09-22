import { BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import type { SignalService } from '../../services/SignalService';
import type { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';

/**
 * Osciloscopio sobre la barra que muestra en vivo la respuesta de un lazo de control.
 */
export class Oscilloscope extends SceneObject implements Updatable, Powerable {
  private static readonly POSITION = { x: -1.2, y: 1.09, z: 0.72 };
  private static readonly ROTATION_Y = 0.38;
  private static readonly BODY = { width: 0.52, height: 0.34, depth: 0.38 };
  private static readonly SCREEN = { width: 0.3, height: 0.21, x: -0.08, offset: 0.001 };
  private static readonly KNOB = { radius: 0.025, depth: 0.03, x: 0.17, spacing: 0.08 };
  private static readonly CANVAS = { width: 256, height: 180, grid: 8, samples: 96 };
  private static readonly REFRESH_RATE = 30;
  private static readonly TRACE_HEIGHT = 0.8;
  private static readonly GLOW = 2.6;
  private static readonly OFF_GLOW = 0.02;
  private static readonly LIGHT = { color: 0x39ff9c, intensity: 1.4, distance: 1.6 };
  private static readonly TRACE = {
    color: '#6dffb3',
    setpoint: 'rgba(255, 214, 102, 0.55)',
    width: 3,
    blur: 10,
  };

  private readonly screen = new MeshBasicMaterial();
  private readonly light = new PointLight(Oscilloscope.LIGHT.color, 0, Oscilloscope.LIGHT.distance, 2);
  private context: CanvasRenderingContext2D | null = null;
  private sinceRefresh = 0;

  /**
   * Crea el osciloscopio.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas.
   * @param signal Service que simula el lazo de control.
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly textures: CanvasTextureFactory,
    private readonly signal: SignalService,
  ) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.screen.color.setScalar(Math.max(level * Oscilloscope.GLOW, Oscilloscope.OFF_GLOW));
    this.light.intensity = level * Oscilloscope.LIGHT.intensity;
  }

  /**
   * @inheritdoc
   */
  public update(delta: number, elapsed: number): void {
    this.sinceRefresh += delta;
    if (this.sinceRefresh < 1 / Oscilloscope.REFRESH_RATE || !this.context || !this.screen.map) {
      return;
    }
    this.sinceRefresh = 0;
    this.draw(this.context, elapsed);
    this.screen.map.needsUpdate = true;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { width, height, depth } = Oscilloscope.BODY;
    this.add(new Mesh(new BoxGeometry(width, height, depth), this.materials.darkMetal), {
      x: 0,
      y: height / 2,
      z: 0,
    });
    this.buildScreen(height, depth);
    this.buildKnobs(height, depth);
    this.add(this.light, { x: Oscilloscope.SCREEN.x, y: height / 2, z: depth });
    this.root.position.copy(Oscilloscope.POSITION);
    this.root.rotation.y = Oscilloscope.ROTATION_Y;
    this.setPower(0);
  }

  /**
   * Pantalla con textura de canvas que se redibuja en cada refresco.
   *
   * @param height Alto del cuerpo.
   * @param depth Profundidad del cuerpo.
   */
  private buildScreen(height: number, depth: number): void {
    const { width, height: screenHeight, x, offset } = Oscilloscope.SCREEN;
    this.screen.map = this.own(
      this.textures.paint(Oscilloscope.CANVAS.width, Oscilloscope.CANVAS.height, (context) => {
        this.context = context;
      }),
    );
    const plane = new Mesh(new PlaneGeometry(width, screenHeight), this.screen);
    this.add(plane, { x, y: height / 2, z: depth / 2 + offset });
  }

  /**
   * Perillas del panel frontal.
   *
   * @param height Alto del cuerpo.
   * @param depth Profundidad del cuerpo.
   */
  private buildKnobs(height: number, depth: number): void {
    const { radius, depth: knobDepth, x, spacing } = Oscilloscope.KNOB;
    [-1, 0, 1].forEach((row) => {
      const knob = new Mesh(
        new CylinderGeometry(radius, radius, knobDepth, GeometryDetail.Low),
        this.materials.metal,
      );
      knob.rotation.x = Math.PI / 2;
      this.add(knob, { x, y: height / 2 + row * spacing, z: depth / 2 + knobDepth / 2 });
    });
  }

  /**
   * Dibuja la retícula, la referencia y la salida del lazo.
   *
   * @param context Contexto 2D de la pantalla.
   * @param time Tiempo actual.
   */
  private draw(context: CanvasRenderingContext2D, time: number): void {
    const { width, height, samples } = Oscilloscope.CANVAS;
    context.fillStyle = '#021a0e';
    context.fillRect(0, 0, width, height);
    this.drawGrid(context);
    const trace = this.signal.trace(time, samples);
    this.drawLine(
      context,
      trace.map((sample) => sample.setpoint),
      Oscilloscope.TRACE.setpoint,
      0,
    );
    this.drawLine(
      context,
      trace.map((sample) => sample.output),
      Oscilloscope.TRACE.color,
      Oscilloscope.TRACE.blur,
    );
  }

  /**
   * Retícula de divisiones.
   *
   * @param context Contexto 2D.
   */
  private drawGrid(context: CanvasRenderingContext2D): void {
    const { width, height, grid } = Oscilloscope.CANVAS;
    context.strokeStyle = 'rgba(80, 255, 170, 0.14)';
    context.lineWidth = 1;
    context.beginPath();
    for (let division = 1; division < grid; division += 1) {
      context.moveTo((width / grid) * division, 0);
      context.lineTo((width / grid) * division, height);
      context.moveTo(0, (height / grid) * division);
      context.lineTo(width, (height / grid) * division);
    }
    context.stroke();
  }

  /**
   * Dibuja una señal normalizada [-1, 1] ocupando todo el ancho.
   *
   * @param context Contexto 2D.
   * @param values Valores de la señal.
   * @param color Color del trazo.
   * @param blur Halo del trazo.
   */
  private drawLine(context: CanvasRenderingContext2D, values: number[], color: string, blur: number): void {
    const { width, height } = Oscilloscope.CANVAS;
    context.strokeStyle = color;
    context.lineWidth = Oscilloscope.TRACE.width;
    context.shadowColor = color;
    context.shadowBlur = blur;
    context.beginPath();
    values.forEach((value, index) => {
      context.lineTo(
        (index / (values.length - 1)) * width,
        height / 2 - value * (height / 2) * Oscilloscope.TRACE_HEIGHT,
      );
    });
    context.stroke();
    context.shadowBlur = 0;
  }
}
