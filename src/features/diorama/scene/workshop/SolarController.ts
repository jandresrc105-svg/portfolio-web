import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Material,
  type Texture,
  type Vector3Like,
} from 'three';
import { GeometryDetail } from '@shared/engine/GeometryDetail';
import { SceneObject } from '@shared/engine/SceneObject';
import type { Updatable } from '@shared/engine/Updatable';
import type { Powerable } from '../../models/Powerable';
import { CanvasTextureFactory } from '../CanvasTextureFactory';
import type { MaterialLibrary } from '../MaterialLibrary';
import { BatteryBank } from './BatteryBank';
import { WorkshopLayout } from './WorkshopLayout';

/**
 * Respaldo solar del taller, en la pared izquierda: el controlador de carga con su pantalla LCD, el banco de
 * baterías en el piso y el tubo que sube a los paneles del techo. Escucha la red de la calle: con red muestra
 * "RED OK" y la batería se recarga; si alguien baja el MAIN del poste, el inversor toma la carga (luz ámbar) y
 * la batería empieza a bajar. El taller no se apaga: vive de lo que guardaron los paneles.
 */
export class SolarController extends SceneObject implements Updatable, Powerable {
  private static readonly WALL = { x: -2.24 };
  private static readonly BOX = {
    width: 0.08,
    height: 0.26,
    depth: 0.38,
    y: 1.45,
    z: -0.25,
    color: 0xd9dcd6,
  };
  private static readonly SCREEN = { width: 0.3, height: 0.12, y: 0.03, lift: 0.001 };
  private static readonly LEDS = [
    { z: -0.1, color: 0x3dff8a, grid: true },
    { z: 0.1, color: 0xffa726, grid: false },
  ];
  private static readonly LED = { radius: 0.012, y: -0.08, glow: 3, off: 0.05 };
  private static readonly BATTERIES = [{ z: -0.62 }, { z: -0.22 }];
  private static readonly BATTERY = {
    width: 0.24,
    height: 0.3,
    depth: 0.34,
    x: 0.18,
    lid: 0.04,
    color: 0x23303a,
  };
  private static readonly CONDUIT = { radius: 0.018, color: 0x9aa0a6 };
  private static readonly ART = { width: 256, height: 104, margin: 12, bar: { y: 70, height: 20 } };
  private static readonly COLORS = { back: '#0c2418', text: '#8dffbf', dim: '#2f6b48', warn: '#ffb347' };
  private static readonly TEXT = { size: 22, title: 34, bottom: 98 };
  private static readonly SCREEN_GLOW = 1.3;
  private static readonly FULL = 100;

  private readonly battery = new BatteryBank();
  private readonly screen = new MeshBasicMaterial({ toneMapped: false });
  private readonly leds = SolarController.LEDS.map(
    ({ color }) => new MeshBasicMaterial({ color, toneMapped: false }),
  );
  private readonly layout = new WorkshopLayout();
  private power = 0;

  /**
   * Crea el respaldo solar.
   *
   * @param materials Materiales compartidos.
   * @param textures Fábrica de texturas (para la pantalla).
   */
  public constructor(
    private readonly materials: MaterialLibrary,
    private readonly textures: CanvasTextureFactory,
  ) {
    super();
  }

  /**
   * Cambia entre la red de la calle y el inversor.
   *
   * @param grid `true` si hay red.
   */
  public setGrid(grid: boolean): void {
    this.battery.setGrid(grid);
    this.redraw();
    this.relight();
  }

  /**
   * @inheritdoc
   */
  public setPower(level: number): void {
    this.power = level;
    this.relight();
  }

  /**
   * @inheritdoc
   */
  public update(delta: number): void {
    if (this.battery.update(delta)) {
      this.redraw();
    }
  }

  /**
   * @inheritdoc
   */
  public override dispose(): void {
    this.screen.map?.dispose();
    super.dispose();
  }

  /**
   * @inheritdoc
   */
  protected override build(): void {
    this.buildController();
    this.buildBatteries();
    this.layout.place(this.root);
    this.redraw();
    this.relight();
  }

  /**
   * Caja del controlador en la pared, con la pantalla, las dos luces y el tubo que sube al techo.
   */
  private buildController(): void {
    const { x } = SolarController.WALL;
    const box = SolarController.BOX;
    const face = x + box.width;
    this.box(
      box,
      { x: x + box.width / 2, y: box.y, z: box.z },
      new MeshStandardMaterial({ color: box.color }),
    );
    const screen = SolarController.SCREEN;
    const panel = this.add(new Mesh(new PlaneGeometry(screen.width, screen.height), this.screen), {
      x: face + screen.lift,
      y: box.y + screen.y,
      z: box.z,
    });
    panel.rotation.y = Math.PI / 2;
    this.buildLeds(face);
    const top = WorkshopLayout.SHOP.height - (box.y + box.height / 2);
    this.buildConduit({ x: x + box.width / 2, y: box.y + box.height / 2 + top / 2, z: box.z }, top);
  }

  /**
   * Luces de estado bajo la pantalla: verde con red, ámbar con el inversor.
   *
   * @param face Cara frontal de la caja.
   */
  private buildLeds(face: number): void {
    const { radius, y } = SolarController.LED;
    const box = SolarController.BOX;
    SolarController.LEDS.forEach(({ z }, index) => {
      const led = new Mesh(
        new CylinderGeometry(radius, radius, radius, GeometryDetail.Low),
        this.leds[index],
      );
      led.rotation.z = Math.PI / 2;
      this.add(led, { x: face, y: box.y + y, z: box.z + z });
    });
  }

  /**
   * Tubo vertical de la caja al techo, por donde bajan los cables de los paneles.
   *
   * @param center Centro del tubo.
   * @param height Largo del tubo.
   */
  private buildConduit(center: Vector3Like, height: number): void {
    const { radius, color } = SolarController.CONDUIT;
    const tube = new CylinderGeometry(radius, radius, height, GeometryDetail.Low);
    this.add(new Mesh(tube, new MeshStandardMaterial({ color, metalness: 0.5 })), center);
  }

  /**
   * Baterías en el piso, contra la pared.
   */
  private buildBatteries(): void {
    const battery = SolarController.BATTERY;
    const shell = new MeshStandardMaterial({ color: battery.color, roughness: 0.6 });
    const floor = WorkshopLayout.SHOP.floor;
    SolarController.BATTERIES.forEach(({ z }) => {
      const center = { x: SolarController.WALL.x + battery.x, y: floor + battery.height / 2, z };
      this.box(battery, center, shell);
      this.add(
        new Mesh(new BoxGeometry(battery.width, battery.lid, battery.depth), this.materials.darkMetal),
        {
          ...center,
          y: floor + battery.height,
        },
      );
    });
  }

  /**
   * Redibuja la pantalla con la fuente y la carga actuales.
   */
  private redraw(): void {
    const old = this.screen.map;
    const art = this.art(old);
    if (art === old) {
      return;
    }
    this.screen.map = art;
    old?.dispose();
    this.screen.needsUpdate = true;
  }

  /**
   * Brillo de la pantalla y de las luces según la fuente y la energía de la intro.
   */
  private relight(): void {
    this.screen.color.setScalar(Math.max(this.power * SolarController.SCREEN_GLOW, SolarController.LED.off));
    SolarController.LEDS.forEach(({ color, grid }, index) => {
      const lit = grid === this.battery.onGrid ? this.power * SolarController.LED.glow : 0;
      this.leds[index]?.color.set(color).multiplyScalar(Math.max(lit, SolarController.LED.off));
    });
  }

  /**
   * Pantalla del controlador: fuente, estado de los paneles y barra de carga.
   *
   * @param into Textura actual, que se repinta en su lugar si se puede.
   * @returns Textura de la pantalla.
   */
  private art(into: Texture | null): Texture {
    const { width, height } = SolarController.ART;
    return this.textures.paint(
      width,
      height,
      (context) => {
        this.paintScreen(context);
      },
      undefined,
      into,
    );
  }

  /**
   * Dibuja la pantalla: estado de la red, carga y porcentaje de la batería.
   *
   * @param context Contexto del canvas.
   */
  private paintScreen(context: CanvasRenderingContext2D): void {
    const { width, height, margin } = SolarController.ART;
    const { back, text, warn } = SolarController.COLORS;
    const { size, title, bottom } = SolarController.TEXT;
    const grid = this.battery.onGrid;
    const ink = grid ? text : warn;
    context.fillStyle = back;
    context.fillRect(0, 0, width, height);
    context.fillStyle = ink;
    context.font = `700 ${String(size)}px ${CanvasTextureFactory.MONO_FONT}`;
    context.fillText(grid ? 'RED OK · PV 0 W' : 'SIN RED · INVERSOR', margin, title);
    this.drawCharge(context, ink);
    context.fillStyle = ink;
    context.fillText(`BAT ${String(this.battery.percent)}%`, margin, bottom);
  }

  /**
   * Barra de carga de la batería.
   *
   * @param context Contexto 2D de la pantalla.
   * @param ink Color del texto y de la parte llena.
   */
  private drawCharge(context: CanvasRenderingContext2D, ink: string): void {
    const { width, margin, bar } = SolarController.ART;
    const full = width - margin * 2;
    context.fillStyle = SolarController.COLORS.dim;
    context.fillRect(margin, bar.y - bar.height, full, bar.height);
    context.fillStyle = ink;
    context.fillRect(
      margin,
      bar.y - bar.height,
      (full * this.battery.percent) / SolarController.FULL,
      bar.height,
    );
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param size.width Ancho (x).
   * @param size.height Alto (y).
   * @param size.depth Profundidad (z).
   * @param position Posición del centro.
   * @param material Material.
   */
  private box(
    size: { width: number; height: number; depth: number },
    position: Vector3Like,
    material: Material,
  ): void {
    this.add(new Mesh(new BoxGeometry(size.width, size.height, size.depth), material), position);
  }
}
