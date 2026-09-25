import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import type { Material, Vector3Like } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GeometryDetail } from '@shared/engine/GeometryDetail';

/**
 * Piezas fijas de la máquina expendedora que no se iluminan: ranura de monedas, bandeja de salida con su
 * compuerta y papeleras de reciclaje para latas. Se construyen en un grupo que se suma a la máquina.
 */
export class VendingMachineFixtures {
  private static readonly FINISH = {
    steel: { color: 0xc9d1dc, roughness: 0.25, metalness: 0.9 },
    slot: { color: 0x05070c, roughness: 0.6 },
    bin: { color: 0x2a6fd6, roughness: 0.45 },
  };
  private static readonly COIN = { width: 0.14, height: 0.17, depth: 0.03, x: 0.3, y: 0.26 };
  private static readonly TRAY = { width: 0.5, height: 0.17, depth: 0.05, x: -0.13, y: 0.26 };
  private static readonly FLAP = { width: 0.9, height: 0.7, offset: 0.004 };
  private static readonly BINS = [{ x: 0.72 }, { x: 1.04 }];
  private static readonly BIN = {
    width: 0.28,
    height: 0.62,
    depth: 0.32,
    radius: 0.035,
    hole: 0.07,
    mouth: 0.8,
    rim: 0.012,
  };

  private readonly group = new Group();

  /**
   * Crea las piezas.
   *
   * @param front Coordenada z local de la cara frontal de la máquina.
   */
  public constructor(private readonly front: number) {}

  /**
   * Construye todas las piezas.
   *
   * @returns Grupo con las piezas, en coordenadas locales de la máquina.
   */
  public build(): Group {
    this.buildLowerPanel();
    this.buildBins();
    return this.group;
  }

  /**
   * Ranura de monedas y bandeja de salida con su compuerta oscura.
   */
  private buildLowerPanel(): void {
    const steel = new MeshStandardMaterial(VendingMachineFixtures.FINISH.steel);
    const { COIN: coin, TRAY: tray, FLAP: flap } = VendingMachineFixtures;
    this.box(
      { x: coin.width, y: coin.height, z: coin.depth },
      { x: coin.x, y: coin.y, z: this.front },
      steel,
    );
    this.box(
      { x: tray.width, y: tray.height, z: tray.depth },
      { x: tray.x, y: tray.y, z: this.front },
      steel,
    );
    this.box(
      { x: tray.width * flap.width, y: tray.height * flap.height, z: tray.depth },
      { x: tray.x, y: tray.y, z: this.front + flap.offset },
      new MeshStandardMaterial(VendingMachineFixtures.FINISH.slot),
    );
  }

  /**
   * Papeleras de reciclaje para latas junto a la máquina.
   */
  private buildBins(): void {
    const { width, height, depth, radius, hole, mouth, rim } = VendingMachineFixtures.BIN;
    const plastic = new MeshStandardMaterial(VendingMachineFixtures.FINISH.bin);
    const opening = new MeshBasicMaterial({ color: VendingMachineFixtures.FINISH.slot.color });
    const shell = new RoundedBoxGeometry(width, height, depth, 2, radius);
    VendingMachineFixtures.BINS.forEach(({ x }) => {
      this.place(new Mesh(shell.clone(), plastic), { x, y: height / 2, z: 0 });
      const cylinder = new CylinderGeometry(hole, hole, rim, GeometryDetail.Medium);
      const circle = this.place(new Mesh(cylinder, opening), { x, y: height * mouth, z: depth / 2 });
      circle.rotation.x = Math.PI / 2;
    });
    shell.dispose();
  }

  /**
   * Agrega una caja.
   *
   * @param size Dimensiones.
   * @param position Centro.
   * @param material Material.
   */
  private box(size: Vector3Like, position: Vector3Like, material: Material): void {
    this.place(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), position);
  }

  /**
   * Agrega una malla al grupo en una posición.
   *
   * @param mesh Malla.
   * @param position Posición local.
   * @returns La misma malla.
   */
  private place(mesh: Mesh, position: Vector3Like): Mesh {
    mesh.position.copy(position);
    this.group.add(mesh);
    return mesh;
  }
}
