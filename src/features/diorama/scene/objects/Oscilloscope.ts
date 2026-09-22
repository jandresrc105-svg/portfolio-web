import { BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
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
  private static readonly REFRESH_RATE = 15;
  private static readonly TRACE_HEIGHT = 0.8;
  private static readonly GLOW = 2.6;
  private static readonly OFF_GLOW = 0.02;
  private static readonly TRACE = {
    color: '#b6ffd8',
    halo: 'rgba(80, 255, 170, 0.28)',
    setpoint: 'rgba(255, 214, 102, 0.55)',
    width: 2.5,
    glow: 3.2,
  };

  private readonly screen = new MeshBasicMaterial();
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
      this.textures.paint(
        Oscilloscope.CANVAS.width,
        Oscilloscope.CANVAS.height,
        (context) => {
          this.context = context;
        },
        1,
      ),
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
    const { width, height } = Oscilloscope.CANVAS;
    const { setpoint, color, halo, width: lineWidth, glow } = Oscilloscope.TRACE;
    context.fillStyle = '#021a0e';
    context.fillRect(0, 0, width, height);
    this.drawGrid(context);
    const start = time - this.signal.windowSeconds;
    const setpointAt = (instant: number): number => this.signal.setpoint(instant);
    const outputAt = (instant: number): number => this.signal.output(instant);
    this.drawLine(context, { at: setpointAt, start, color: setpoint, width: lineWidth });
    this.drawLine(context, { at: outputAt, start, color: halo, width: lineWidth * glow });
    this.drawLine(context, { at: outputAt, start, color, width: lineWidth });
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
   * Dibuja una señal normalizada [-1, 1] a lo ancho de la pantalla, muestreándola punto a punto
   * (sin crear arreglos por frame, para no generar basura para el recolector de memoria).
   *
   * @param context Contexto 2D.
   * @param line Trazo a dibujar.
   * @param line.at Función que da el valor de la señal en un instante.
   * @param line.start Instante del borde izquierdo de la pantalla.
   * @param line.color Color del trazo.
   * @param line.width Grosor del trazo.
   */
  private drawLine(
    context: CanvasRenderingContext2D,
    line: { at: (instant: number) => number; start: number; color: string; width: number },
  ): void {
    const { width, height, samples } = Oscilloscope.CANVAS;
    const step = this.signal.windowSeconds / (samples - 1);
    context.strokeStyle = line.color;
    context.lineWidth = line.width;
    context.beginPath();
    for (let index = 0; index < samples; index += 1) {
      const value = line.at(line.start + index * step);
      context.lineTo(
        (index / (samples - 1)) * width,
        height / 2 - value * (height / 2) * Oscilloscope.TRACE_HEIGHT,
      );
    }
    context.stroke();
  }
}
