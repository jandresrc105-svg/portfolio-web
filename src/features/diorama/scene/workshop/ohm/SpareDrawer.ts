import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import type { OhmLabArt } from './OhmLabArt';

/**
 * Cajoncito de repuestos: organizador de plástico con un cajón etiquetado "LED 5mm" y, en la bandeja de
 * arriba, unos LEDs rojos sueltos. Al poner un LED nuevo el cajón se abre y se cierra. Todo el organizador
 * recibe el clic. Se construye en un grupo con origen en el centro de su base.
 */
export class SpareDrawer {
  private static readonly CASE = { width: 0.1, height: 0.04, depth: 0.06, color: 0x2d5c8a };
  private static readonly FRONT = { width: 0.088, height: 0.03, depth: 0.004, color: 0x9fc4e6 };
  private static readonly TAG = { width: 0.05, height: 0.018 };
  private static readonly HANDLE = { width: 0.02, height: 0.004, depth: 0.006, y: -0.009, color: 0x1a2a3a };
  private static readonly SPARES = [
    { x: -0.03, z: -0.01 },
    { x: -0.012, z: 0.008 },
    { x: 0.008, z: -0.012 },
    { x: 0.026, z: 0.006 },
  ];
  private static readonly SPARE = { radius: 0.0045, color: 0xb81c12 };
  private static readonly SLIDE = { open: 0.028, duration: 0.8 };
  private static readonly HIGHLIGHT = { color: 0x3fd8ff, strength: 0.35 };
  private static readonly LIFT = 0.0005;

  public readonly group = new Group();
  public readonly hitArea: Mesh;

  private readonly shell = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.1, envMapIntensity: 0.4 });
  private readonly drawer = new Group();
  private slide = SpareDrawer.SLIDE.duration;

  /**
   * Crea el cajón.
   *
   * @param art Serigrafías fijas.
   */
  public constructor(private readonly art: OhmLabArt) {
    const { width, height, depth, color } = SpareDrawer.CASE;
    this.shell.color.set(color);
    this.hitArea = new Mesh(new BoxGeometry(width, height, depth), this.shell);
  }

  /**
   * Construye el organizador, el cajón y los LEDs sueltos.
   *
   * @returns Grupo del cajón.
   */
  public build(): Group {
    const { height, depth } = SpareDrawer.CASE;
    this.hitArea.position.y = height / 2;
    this.buildDrawer();
    this.drawer.position.set(0, height / 2, depth / 2);
    this.group.add(this.hitArea, this.drawer, this.buildSpares());
    return this.group;
  }

  /**
   * Abre y cierra el cajón (al sacar un LED nuevo).
   */
  public nudge(): void {
    this.slide = 0;
  }

  /**
   * Mueve el cajón: sale y vuelve a entrar.
   *
   * @param delta Segundos desde el frame anterior.
   */
  public update(delta: number): void {
    const { open, duration } = SpareDrawer.SLIDE;
    this.slide = Math.min(this.slide + delta, duration);
    const phase = this.slide / duration;
    this.drawer.position.z = SpareDrawer.CASE.depth / 2 + open * Math.sin(phase * Math.PI);
  }

  /**
   * Resalta el organizador señalado.
   *
   * @param active Si está señalado.
   */
  public highlight(active: boolean): void {
    const { color, strength } = SpareDrawer.HIGHLIGHT;
    this.shell.emissive.set(color).multiplyScalar(active ? strength : 0);
  }

  /**
   * Frente del cajón con su etiqueta y la manija.
   */
  private buildDrawer(): void {
    const { width, height, depth, color } = SpareDrawer.FRONT;
    const front = new Mesh(
      new BoxGeometry(width, height, depth),
      new MeshStandardMaterial({ color, roughness: 0.3, transparent: true, opacity: 0.85 }),
    );
    front.position.z = depth / 2;
    const tag = SpareDrawer.TAG;
    const label = new Mesh(
      new PlaneGeometry(tag.width, tag.height),
      new MeshBasicMaterial({ map: this.art.drawerTag(), color: 0xb0b0b0 }),
    );
    label.position.set(0, (height - tag.height) / 2, depth + SpareDrawer.LIFT);
    this.drawer.add(front, label, SpareDrawer.grip(depth));
  }

  /**
   * LEDs rojos sueltos sobre el organizador (una sola malla instanciada).
   *
   * @returns Malla de los LEDs.
   */
  private buildSpares(): InstancedMesh {
    const { radius, color } = SpareDrawer.SPARE;
    const spares = new InstancedMesh(
      new SphereGeometry(radius, GeometryDetail.Low, GeometryDetail.Thin),
      new MeshStandardMaterial({ color, roughness: 0.2, envMapIntensity: 0.5 }),
      SpareDrawer.SPARES.length,
    );
    const matrix = new Matrix4();
    SpareDrawer.SPARES.forEach(({ x, z }, index) => {
      spares.setMatrixAt(index, matrix.makeTranslation(x, SpareDrawer.CASE.height + radius / 2, z));
    });
    return spares;
  }

  /**
   * Manija del cajón.
   *
   * @param front Profundidad del frente del cajón.
   * @returns Malla de la manija.
   */
  private static grip(front: number): Mesh {
    const handle = SpareDrawer.HANDLE;
    const grip = new Mesh(
      new BoxGeometry(handle.width, handle.height, handle.depth),
      new MeshStandardMaterial({ color: handle.color, roughness: 0.5 }),
    );
    grip.position.set(0, handle.y, front + handle.depth / 2);
    return grip;
  }
}
