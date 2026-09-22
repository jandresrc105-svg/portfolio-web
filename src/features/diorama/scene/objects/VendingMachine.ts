import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, PointLight } from 'three';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Powerable } from '../../models/Powerable';
import { CanvasTextureFactory } from '../CanvasTextureFactory';

/**
 * Máquina expendedora japonesa: vitrina iluminada con latas de colores. Cada lata representa un proyecto.
 */
export class VendingMachine extends SceneObject implements Powerable {
  private static readonly POSITION = { x: 3.55, y: 0, z: 0.05 };
  private static readonly ROTATION_Y = -0.42;
  private static readonly BODY = { width: 1, height: 1.9, depth: 0.78, color: 0xe4e8ee };
  private static readonly PANEL = { width: 0.86, height: 1.18, y: 1.2 };
  private static readonly SLOT = { width: 0.6, height: 0.2, depth: 0.05, y: 0.32 };
  private static readonly GLOW = 1.05;
  private static readonly OFF_GLOW = 0.05;
  private static readonly LIGHT = { color: 0xcfe6ff, intensity: 7, distance: 4.5, z: 0.9, y: 1.1 };
  private static readonly CANVAS = { width: 344, height: 472, banner: 64, rows: 4, columns: 5, margin: 14 };
  private static readonly CAN_COLORS = [
    '#e53945',
    '#f4a261',
    '#2a9d8f',
    '#4cc9f0',
    '#f1fa8c',
    '#b5179e',
    '#ffffff',
  ];
  private static readonly CAN_RATIO = 0.62;
  private static readonly FRONT_OFFSET = 0.001;

  private readonly panel = new MeshBasicMaterial();
  private readonly light = new PointLight(VendingMachine.LIGHT.color, 0, VendingMachine.LIGHT.distance, 2);

  /**
   * Crea la máquina.
   *
   * @param textures Fábrica de texturas.
   */
  public constructor(private readonly textures: CanvasTextureFactory) {
    super();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.panel.color.setScalar(Math.max(level * VendingMachine.GLOW, VendingMachine.OFF_GLOW));
    this.light.intensity = level * VendingMachine.LIGHT.intensity;
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    const { width, height, depth, color } = VendingMachine.BODY;
    const body = new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
    this.add(new Mesh(new BoxGeometry(width, height, depth), body), { x: 0, y: height / 2, z: 0 });
    this.panel.map = this.own(this.panelTexture());
    const front = depth / 2 + VendingMachine.FRONT_OFFSET;
    const { width: panelWidth, height: panelHeight, y } = VendingMachine.PANEL;
    this.add(new Mesh(new PlaneGeometry(panelWidth, panelHeight), this.panel), { x: 0, y, z: front });
    const slot = VendingMachine.SLOT;
    const dark = new MeshStandardMaterial({ color: 0x050507, roughness: 0.5 });
    this.add(new Mesh(new BoxGeometry(slot.width, slot.height, slot.depth), dark), {
      x: 0,
      y: slot.y,
      z: front,
    });
    this.add(this.light, { x: 0, y: VendingMachine.LIGHT.y, z: VendingMachine.LIGHT.z });
    this.root.position.copy(VendingMachine.POSITION);
    this.root.rotation.y = VendingMachine.ROTATION_Y;
    this.setPower(0);
  }

  /**
   * Vitrina: franja superior con el título y filas de latas.
   *
   * @returns Textura del panel frontal.
   */
  private panelTexture(): ReturnType<CanvasTextureFactory['paint']> {
    const { width, height, banner } = VendingMachine.CANVAS;
    return this.textures.paint(width, height, (context) => {
      context.fillStyle = '#dff1ff';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#0b3d91';
      context.fillRect(0, 0, width, banner);
      context.fillStyle = '#ffffff';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = `800 34px ${CanvasTextureFactory.MONO_FONT}`;
      context.fillText('PROYECTOS', width / 2, banner / 2);
      this.drawCans(context);
    });
  }

  /**
   * Dibuja la cuadrícula de latas.
   *
   * @param context Contexto 2D.
   */
  private drawCans(context: CanvasRenderingContext2D): void {
    const { width, height, banner, rows, columns, margin } = VendingMachine.CANVAS;
    const cell = { width: (width - margin * 2) / columns, height: (height - banner - margin * 2) / rows };
    for (let index = 0; index < rows * columns; index += 1) {
      VendingMachine.drawCan(context, index % columns, Math.floor(index / columns), cell);
    }
  }

  /**
   * Dibuja una lata en su celda, alternando colores.
   *
   * @param context Contexto 2D.
   * @param column Columna de la celda.
   * @param row Fila de la celda.
   * @param cell Tamaño de la celda.
   * @param cell.width Ancho de la celda.
   * @param cell.height Alto de la celda.
   */
  private static drawCan(
    context: CanvasRenderingContext2D,
    column: number,
    row: number,
    cell: { width: number; height: number },
  ): void {
    const { banner, margin, columns } = VendingMachine.CANVAS;
    const colors = VendingMachine.CAN_COLORS;
    const canWidth = cell.width * VendingMachine.CAN_RATIO;
    const x = margin + column * cell.width + (cell.width - canWidth) / 2;
    const y = banner + margin * 2 + row * cell.height;
    context.fillStyle = colors[((row * columns + column) * 3 + row) % colors.length] ?? '#ffffff';
    context.beginPath();
    context.roundRect(x, y, canWidth, cell.height - margin * 2, margin / 2);
    context.fill();
  }
}
