import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type CanvasTexture,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Panel de progreso de la estación de cableado, colgado de la pared derecha: una placa negra serigrafiada con
 * los cinco pasos, un LED por paso (una sola malla instanciada) y el botón rojo REINICIAR. El grupo tiene el
 * origen en el centro de la placa y mira hacia +z; el soporte llega hasta la pared en +x.
 */
export class StepPanel {
  public static readonly STEPS = ['CORTAR', 'PELAR', 'TORCER', 'ESTAÑAR', 'CONECTAR'];

  private static readonly PLATE = {
    width: 0.3,
    height: 0.13,
    depth: 0.012,
    lift: 0.0008,
    color: 0x15181c,
    face: 0x9a9a9a,
  };
  private static readonly ART = { width: 300, height: 130, pad: 12, title: 15, label: 9, ink: '#d9dee4' };
  private static readonly LAMP = { radius: 0.0065, depth: 0.006, left: -0.125, gap: 0.046, y: 0.004 };
  private static readonly BUTTON = { radius: 0.014, depth: 0.01, x: 0.118, y: 0.004, color: 0xc81e24 };
  private static readonly BRACKET = { width: 0.1, height: 0.012, depth: 0.012, rise: 0.04, color: 0x2b2f35 };
  private static readonly HIT = { size: 0.045 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.5 };
  private static readonly TEXT = { labelY: 0.019, footY: 0.047 };

  public readonly group = new Group();
  public readonly hitArea = new Mesh(
    new BoxGeometry(StepPanel.HIT.size, StepPanel.HIT.size, StepPanel.HIT.size),
    new MeshBasicMaterial({ visible: false }),
  );

  private readonly lamps: InstancedMesh;
  private readonly button = new MeshStandardMaterial({
    color: StepPanel.BUTTON.color,
    roughness: 0.4,
    envMapIntensity: 0.3,
  });
  private readonly tint = new Color();

  /**
   * Crea el panel.
   *
   * @param art Serigrafía de la placa.
   */
  public constructor(private readonly art: CanvasTexture) {
    const { radius, depth } = StepPanel.LAMP;
    const geometry = new CylinderGeometry(radius, radius, depth, GeometryDetail.Low);
    geometry.rotateX(Math.PI / 2);
    this.lamps = new InstancedMesh(
      geometry,
      new MeshBasicMaterial({ toneMapped: false }),
      StepPanel.STEPS.length,
    );
  }

  /**
   * Dibuja la serigrafía: título, nombre de cada paso bajo su LED y la leyenda del botón.
   *
   * @param context Contexto del canvas.
   */
  public static paint(context: CanvasRenderingContext2D): void {
    const { width, height, pad, title, ink } = StepPanel.ART;
    context.fillStyle = '#15181c';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#3a4048';
    context.strokeRect(pad / 2, pad / 2, width - pad, height - pad);
    context.fillStyle = ink;
    context.textAlign = 'center';
    context.font = `bold ${String(title)}px sans-serif`;
    context.fillText('ESTACIÓN DE CABLEADO', width / 2, pad + title);
    StepPanel.paintLabels(context);
  }

  /**
   * Construye la placa, los LED, el botón y el soporte a la pared.
   *
   * @param wall Distancia del centro de la placa a la pared (en +x).
   * @returns Grupo del panel.
   */
  public build(wall: number): Group {
    const { width, height, depth, color } = StepPanel.PLATE;
    const plate = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color, roughness: 0.6, envMapIntensity: 0.3 }),
    );
    const face = new Mesh(
      new PlaneGeometry(width, height),
      new MeshBasicMaterial({ map: this.art, color: StepPanel.PLATE.face }),
    );
    face.position.z = depth / 2 + StepPanel.PLATE.lift;
    this.placeLamps(depth / 2);
    const { radius, depth: press, x, y } = StepPanel.BUTTON;
    const button = new Mesh(new CylinderGeometry(radius, radius, press, GeometryDetail.Medium), this.button);
    button.rotation.x = Math.PI / 2;
    button.position.set(x, y, depth / 2 + press / 2);
    this.hitArea.position.copy(button.position);
    this.group.add(plate, face, this.lamps, button, this.hitArea, this.buildBracket(wall));
    return this.group;
  }

  /**
   * Enciende los LED de los pasos.
   *
   * @param lamps Color y brillo de cada LED, en el orden de los pasos.
   */
  public show(lamps: readonly { color: number; glow: number }[]): void {
    lamps.forEach(({ color, glow }, index) => {
      this.lamps.setColorAt(index, this.tint.set(color).multiplyScalar(glow));
    });
    if (this.lamps.instanceColor) {
      this.lamps.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Resalta el botón señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = StepPanel.HIGHLIGHT;
    this.button.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Ubica los LED en fila sobre la placa.
   *
   * @param front Cara frontal de la placa.
   */
  private placeLamps(front: number): void {
    const { left, gap, y, depth } = StepPanel.LAMP;
    const matrix = new Matrix4();
    StepPanel.STEPS.forEach((_, index) => {
      matrix.makeTranslation(left + index * gap, y, front + depth / 2);
      this.lamps.setMatrixAt(index, matrix);
      this.lamps.setColorAt(index, this.tint.setScalar(0));
    });
  }

  /**
   * Escuadra que une el borde derecho de la placa con la pared.
   *
   * @param wall Distancia del centro de la placa a la pared.
   * @returns Malla del soporte.
   */
  private buildBracket(wall: number): Mesh {
    const { width, height, depth, rise, color } = StepPanel.BRACKET;
    const span = Math.max(wall - StepPanel.PLATE.width / 2 + width / 2, width);
    const bracket = new Mesh(
      new BoxGeometry(span, height, depth),
      new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 }),
    );
    bracket.position.set(wall - span / 2, StepPanel.PLATE.height / 2 - rise, -StepPanel.PLATE.depth);
    return bracket;
  }

  /**
   * Nombre de cada paso bajo su LED, la leyenda del botón y el resumen al pie.
   *
   * @param context Contexto del canvas.
   */
  private static paintLabels(context: CanvasRenderingContext2D): void {
    const { width, height, label } = StepPanel.ART;
    const scale = width / StepPanel.PLATE.width;
    const { left, gap } = StepPanel.LAMP;
    const y = height / 2 + StepPanel.TEXT.labelY * scale;
    context.font = `${String(label)}px sans-serif`;
    StepPanel.STEPS.forEach((step, index) => {
      context.fillText(step, width / 2 + (left + index * gap) * scale, y);
    });
    context.fillText('REINICIAR', width / 2 + StepPanel.BUTTON.x * scale, y);
    context.fillStyle = '#7d8791';
    const foot = height / 2 + StepPanel.TEXT.footY * scale;
    context.fillText('pelar · torcer · estañar · apretar', width / 2, foot);
  }
}
